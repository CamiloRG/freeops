/**
 * Tool-level behaviour: the connect/upsert path, availability
 * orchestration, the re-check-before-write race guard, delete, and the
 * multi-provider status lookup.
 *
 * Every provider call is mocked at the adapter seam; no network, no DB.
 */
import { describe, expect, it } from "vitest";
import { decryptField } from "@freeops/db/encryption";
import { ProviderApiError } from "../src/errors.js";
import {
  connectCalendar,
  createBookingEvent,
  deleteEvent,
  getAvailability,
  getConnectionStatus,
  type ToolDeps,
} from "../src/tools.js";
import { createFakeAdapter, createFakeStore, makeConnection, registryFor } from "./fakes.js";

const FREELANCER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-06-01T12:00:00Z");

function depsFor(store: ReturnType<typeof createFakeStore>, adapter: ReturnType<typeof createFakeAdapter>): ToolDeps {
  return { store, adapters: registryFor(adapter), now: () => NOW };
}

describe("connect_calendar", () => {
  it("encrypts both tokens and upserts an active connection", async () => {
    const store = createFakeStore();
    const adapter = createFakeAdapter({
      async exchangeCode() {
        return {
          accessToken: "fresh-access",
          refreshToken: "fresh-refresh",
          expiresAt: new Date("2026-06-01T13:00:00Z"),
          scope: "calendar.events calendar.freebusy",
        };
      },
      async getAccountEmail() {
        return "connected@example.com";
      },
    });

    const result = await connectCalendar(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      authorizationCode: "auth-code-123",
      redirectUri: "https://app.freeops.example/api/v1/me/calendar/oauth/callback",
    });

    expect(result.providerAccountEmail).toBe("connected@example.com");
    expect(result.status).toBe("active");

    // The redirect URI is echoed to the provider exactly as supplied by
    // the caller — this service never substitutes one of its own.
    expect(adapter.calls.exchangeCode[0]).toEqual({
      code: "auth-code-123",
      redirectUri: "https://app.freeops.example/api/v1/me/calendar/oauth/callback",
    });

    expect(store.upsertCalls).toHaveLength(1);
    const upserted = store.upsertCalls[0]!;
    expect(decryptField(upserted.accessTokenEncrypted)).toBe("fresh-access");
    expect(decryptField(upserted.refreshTokenEncrypted)).toBe("fresh-refresh");
    // Plaintext must never be what lands in the bytea columns.
    expect(upserted.accessTokenEncrypted.toString("utf8")).not.toContain("fresh-access");
  });

  it("replaces the tokens on a reconnect rather than creating a second row", async () => {
    const existing = makeConnection({ userId: FREELANCER_ID, provider: "google" });
    const store = createFakeStore([existing]);
    const adapter = createFakeAdapter({
      async exchangeCode() {
        return {
          accessToken: "reconnected-access",
          refreshToken: "reconnected-refresh",
          expiresAt: new Date("2026-06-01T13:00:00Z"),
        };
      },
    });

    await connectCalendar(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      authorizationCode: "code",
      redirectUri: "https://example.test/cb",
    });

    expect(store.connections).toHaveLength(1);
    expect(decryptField(store.connections[0]!.refreshTokenEncrypted)).toBe("reconnected-refresh");
  });

  it("refuses to store a connection when the provider issued no refresh token", async () => {
    const store = createFakeStore();
    const adapter = createFakeAdapter({
      async exchangeCode() {
        // e.g. Google without access_type=offline, or Microsoft without offline_access.
        return { accessToken: "only-access", expiresAt: null };
      },
    });

    await expect(
      connectCalendar(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "microsoft",
        authorizationCode: "code",
        redirectUri: "https://example.test/cb",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });

    expect(store.upsertCalls).toHaveLength(0);
  });
});

describe("get_availability", () => {
  it("returns slots computed from the provider's busy intervals", async () => {
    const connection = makeConnection({ userId: FREELANCER_ID });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      async getBusyIntervals() {
        return [
          { start: new Date("2026-08-20T15:00:00Z"), end: new Date("2026-08-20T15:30:00Z") },
        ];
      },
    });

    const result = await getAvailability(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      dateRangeStart: "2026-08-20T14:00:00Z",
      dateRangeEnd: "2026-08-20T16:00:00Z",
      durationMinutes: 30,
      bufferMinutes: 0,
    });

    expect(result.slots.map((s) => s.start)).toEqual([
      "2026-08-20T14:00:00.000Z",
      "2026-08-20T14:30:00.000Z",
      "2026-08-20T15:30:00.000Z",
    ]);
    // The provider is queried for exactly the requested window.
    expect(adapter.calls.getBusyIntervals[0]?.start.toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
    expect(connection.lastSyncedAt).toEqual(NOW);
  });

  it("fails with NOT_CONNECTED when the freelancer has no connection for that provider", async () => {
    const store = createFakeStore([makeConnection({ userId: FREELANCER_ID, provider: "google" })]);
    const adapter = createFakeAdapter({ provider: "microsoft" });

    await expect(
      getAvailability(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "microsoft",
        dateRangeStart: "2026-08-20T14:00:00Z",
        dateRangeEnd: "2026-08-20T16:00:00Z",
        durationMinutes: 30,
        bufferMinutes: 0,
      })
    ).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });

  it("rejects an inverted range", async () => {
    const store = createFakeStore([makeConnection({ userId: FREELANCER_ID })]);
    const adapter = createFakeAdapter();

    await expect(
      getAvailability(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        dateRangeStart: "2026-08-20T16:00:00Z",
        dateRangeEnd: "2026-08-20T14:00:00Z",
        durationMinutes: 30,
        bufferMinutes: 0,
      })
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("surfaces INVALID_GRANT (and marks the connection 'error') when consent was revoked", async () => {
    // Expiring token forces a refresh, which is where a revoked consent
    // shows up first.
    const connection = makeConnection({
      userId: FREELANCER_ID,
      tokenExpiresAt: new Date("2026-06-01T12:01:00Z"),
    });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      async refreshTokens() {
        throw new ProviderApiError({
          provider: "google",
          status: 400,
          message: "invalid_grant",
          isInvalidGrant: true,
        });
      },
    });

    await expect(
      getAvailability(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        dateRangeStart: "2026-08-20T14:00:00Z",
        dateRangeEnd: "2026-08-20T16:00:00Z",
        durationMinutes: 30,
        bufferMinutes: 0,
      })
    ).rejects.toMatchObject({ code: "INVALID_GRANT" });

    expect(store.setStatusCalls).toEqual([{ connectionId: connection.id, status: "error" }]);
  });
});

describe("create_booking_event — race-condition guard", () => {
  it("re-checks the slot immediately before writing, then inserts", async () => {
    const connection = makeConnection({ userId: FREELANCER_ID });
    const store = createFakeStore([connection]);
    const callOrder: string[] = [];
    const adapter = createFakeAdapter({
      async getBusyIntervals() {
        callOrder.push("getBusyIntervals");
        return [];
      },
      async insertEvent() {
        callOrder.push("insertEvent");
        return { eventId: "evt-abc" };
      },
    });

    const result = await createBookingEvent(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      slotStart: "2026-08-20T14:00:00Z",
      slotEnd: "2026-08-20T14:30:00Z",
      prospectName: "Ana Prospect",
      prospectEmail: "ana@example.com",
      notes: "Discovery call",
    });

    expect(result.providerEventId).toBe("evt-abc");
    // The check must precede the write — the whole point of the guard.
    expect(callOrder).toEqual(["getBusyIntervals", "insertEvent"]);
    // …and it must be scoped to just this slot, not a whole day.
    expect(adapter.calls.getBusyIntervals[0]?.start.toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
    expect(adapter.calls.getBusyIntervals[0]?.end.toISOString()).toBe("2026-08-20T14:30:00.000Z");

    const inserted = adapter.calls.insertEvent[0]!;
    expect(inserted.attendeeEmail).toBe("ana@example.com");
    expect(inserted.attendeeName).toBe("Ana Prospect");
    expect(inserted.description).toBe("Discovery call");
  });

  it("rejects with SLOT_TAKEN and writes nothing when the slot was claimed in the meantime", async () => {
    const connection = makeConnection({ userId: FREELANCER_ID });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter({
      async getBusyIntervals() {
        // The competing prospect's booking landed between the prospect
        // loading the page and submitting it.
        return [
          { start: new Date("2026-08-20T14:15:00Z"), end: new Date("2026-08-20T14:45:00Z") },
        ];
      },
    });

    await expect(
      createBookingEvent(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        slotStart: "2026-08-20T14:00:00Z",
        slotEnd: "2026-08-20T14:30:00Z",
        prospectName: "Ana Prospect",
        prospectEmail: "ana@example.com",
      })
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    // Nothing may reach the calendar once the guard trips.
    expect(adapter.calls.insertEvent).toHaveLength(0);
  });

  it("carries the slot bounds on the SLOT_TAKEN error so the caller can tell the prospect what was lost", async () => {
    const store = createFakeStore([makeConnection({ userId: FREELANCER_ID })]);
    const adapter = createFakeAdapter({
      async getBusyIntervals() {
        return [
          { start: new Date("2026-08-20T14:00:00Z"), end: new Date("2026-08-20T14:30:00Z") },
        ];
      },
    });

    await expect(
      createBookingEvent(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        slotStart: "2026-08-20T14:00:00Z",
        slotEnd: "2026-08-20T14:30:00Z",
        prospectName: "Ana",
        prospectEmail: "ana@example.com",
      })
    ).rejects.toMatchObject({
      code: "SLOT_TAKEN",
      details: {
        slotStart: "2026-08-20T14:00:00.000Z",
        slotEnd: "2026-08-20T14:30:00.000Z",
      },
    });
  });

  it("still books when an adjacent meeting merely touches the slot boundary", async () => {
    const store = createFakeStore([makeConnection({ userId: FREELANCER_ID })]);
    const adapter = createFakeAdapter({
      async getBusyIntervals() {
        return [
          { start: new Date("2026-08-20T13:30:00Z"), end: new Date("2026-08-20T14:00:00Z") },
        ];
      },
    });

    const result = await createBookingEvent(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      slotStart: "2026-08-20T14:00:00Z",
      slotEnd: "2026-08-20T14:30:00Z",
      prospectName: "Ana",
      prospectEmail: "ana@example.com",
    });

    expect(result.providerEventId).toBe("provider-event-1");
  });

  it("rejects a slot whose end is not after its start", async () => {
    const store = createFakeStore([makeConnection({ userId: FREELANCER_ID })]);
    const adapter = createFakeAdapter();

    await expect(
      createBookingEvent(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        slotStart: "2026-08-20T14:30:00Z",
        slotEnd: "2026-08-20T14:00:00Z",
        prospectName: "Ana",
        prospectEmail: "ana@example.com",
      })
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});

describe("delete_event", () => {
  it("deletes through the adapter with the connection's calendar id", async () => {
    const connection = makeConnection({ userId: FREELANCER_ID, externalCalendarId: "cal-7" });
    const store = createFakeStore([connection]);
    const adapter = createFakeAdapter();

    const result = await deleteEvent(depsFor(store, adapter), {
      freelancerId: FREELANCER_ID,
      provider: "google",
      providerEventId: "evt-abc",
    });

    expect(result).toEqual({ provider: "google", providerEventId: "evt-abc", deleted: true });
    expect(adapter.calls.deleteEvent[0]).toMatchObject({
      eventId: "evt-abc",
      calendarId: "cal-7",
    });
  });

  it("fails with NOT_CONNECTED rather than silently succeeding", async () => {
    const store = createFakeStore();
    const adapter = createFakeAdapter();

    await expect(
      deleteEvent(depsFor(store, adapter), {
        freelancerId: FREELANCER_ID,
        provider: "google",
        providerEventId: "evt-abc",
      })
    ).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });
});

describe("get_connection_status", () => {
  it("reports every connected provider, not just one", async () => {
    const store = createFakeStore([
      makeConnection({
        id: "c-google",
        userId: FREELANCER_ID,
        provider: "google",
        providerAccountEmail: "me@gmail.example",
        lastSyncedAt: new Date("2026-05-30T09:00:00Z"),
      }),
      makeConnection({
        id: "c-microsoft",
        userId: FREELANCER_ID,
        provider: "microsoft",
        providerAccountEmail: "me@outlook.example",
        status: "error",
      }),
    ]);

    const result = await getConnectionStatus(depsFor(store, createFakeAdapter()), {
      freelancerId: FREELANCER_ID,
    });

    expect(result.connections).toHaveLength(2);
    expect(result.connections[0]).toMatchObject({
      provider: "google",
      providerAccountEmail: "me@gmail.example",
      status: "active",
      lastSyncedAt: "2026-05-30T09:00:00.000Z",
    });
    // Reports the DB's own vocabulary; translating to the API contract's
    // "connected"/"expired"/"disconnected" is Stage 3's job.
    expect(result.connections[1]).toMatchObject({ provider: "microsoft", status: "error" });
  });

  it("returns an empty list — not an error — when nothing is connected", async () => {
    const result = await getConnectionStatus(depsFor(createFakeStore(), createFakeAdapter()), {
      freelancerId: FREELANCER_ID,
    });
    expect(result.connections).toEqual([]);
  });

  it("does not leak another freelancer's connections", async () => {
    const store = createFakeStore([
      makeConnection({ id: "mine", userId: FREELANCER_ID }),
      makeConnection({ id: "theirs", userId: "33333333-3333-4333-8333-333333333333" }),
    ]);

    const result = await getConnectionStatus(depsFor(store, createFakeAdapter()), {
      freelancerId: FREELANCER_ID,
    });
    expect(result.connections).toHaveLength(1);
  });
});
