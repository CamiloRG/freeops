/**
 * The five calendar operations, as plain async functions.
 *
 * Everything here takes its collaborators (`store`, `adapters`) as an
 * explicit `ToolDeps` argument rather than reaching for module-level
 * singletons. That is what makes the whole of this file testable with no
 * DB and no network: `server.ts` passes the real Drizzle store and the
 * real Google/Microsoft adapters, the test suite passes fakes, and the
 * logic under test is identical in both cases.
 *
 * ── Deliberate deviations from app_spec.md's literal tool list ──
 *
 * 1. `get_availability` takes `provider`, `durationMinutes` and
 *    `bufferMinutes` on top of the spec's
 *    `(freelancerId, dateRangeStart, dateRangeEnd)`.
 *    The spec's own description says the tool "returns open slots after
 *    applying the freelancer's configured meeting length + buffer" — but
 *    those two numbers live on `booking_links`, which is main-app domain.
 *    Reading them here would make this service depend on the booking-link
 *    schema and on the notion of a "configured" link, for a service whose
 *    entire justification is being a narrow, provider-facing free/busy
 *    source. Passing them per call keeps the boundary clean and leaves
 *    this server free/busy-agnostic; the Next.js caller already has the
 *    booking link in hand when it asks.
 *    `provider` is explicit for the same reason: the schema permits a
 *    freelancer to connect BOTH providers, and deciding which one is
 *    "the booking calendar" is a product decision belonging to Stage 2/3,
 *    not a default this service should quietly pick.
 *
 * 2. `create_booking_event` and `delete_event` likewise take `provider`.
 *
 * 3. `calendar_connection_status` is an MCP **tool**, not the Resource the
 *    spec names. Resources are addressed by URI and are aimed at
 *    model-driven context loading; this call has exactly one consumer —
 *    `GET /api/v1/me/calendar/connection` — which is an RPC, and every MCP
 *    client transport supports tools while resource support is optional.
 *    A tool maps 1:1 onto the REST endpoint with less ceremony. It is also
 *    plural by nature: it returns every connected provider rather than
 *    "the" connection, again because the DB allows both.
 *
 * 4. The spec's `refresh_token(freelancerId)` tool is intentionally not
 *    exposed — the spec itself describes it as internally invoked. It
 *    lives in `tokens.ts` and runs inside every tool below.
 */
import { encryptField } from "@freeops/db/encryption";
import { computeAvailableSlots, isSlotStillFree, type Slot } from "./availability.js";
import type { CalendarConnection, ConnectionStore } from "./connections.js";
import { CalendarToolError, NotConnectedError, SlotTakenError } from "./errors.js";
import type { AdapterRegistry } from "./providers/index.js";
import type { CalendarProvider } from "./providers/types.js";
import { withAccessToken } from "./tokens.js";

export interface ToolDeps {
  store: ConnectionStore;
  adapters: AdapterRegistry;
  /** Injectable clock, so tests can pin "now" without faking timers. */
  now?: () => Date;
}

function nowOf(deps: ToolDeps): Date {
  return deps.now ? deps.now() : new Date();
}

async function requireConnection(
  deps: ToolDeps,
  freelancerId: string,
  provider: CalendarProvider
): Promise<CalendarConnection> {
  const connection = await deps.store.findByUserAndProvider(freelancerId, provider);
  if (!connection) throw new NotConnectedError(freelancerId, provider);
  return connection;
}

/** Parses an ISO-8601 instant, rejecting anything ambiguous. */
function parseInstant(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CalendarToolError("INVALID_ARGUMENT", `${field} is not a valid ISO-8601 instant.`, {
      field,
      value,
    });
  }
  return date;
}

// ───────────────────────────── connect_calendar ─────────────────────────────

export interface ConnectCalendarInput {
  freelancerId: string;
  provider: CalendarProvider;
  authorizationCode: string;
  /**
   * The redirect URI the authorization code was issued against. Passed in
   * per call (not read from this service's env) because only the Next.js
   * app knows its own origin, which differs across local dev, Vercel
   * preview deploys and production — and both providers require the
   * exchange to echo the exact URI used at authorization time.
   */
  redirectUri: string;
}

export interface ConnectCalendarResult {
  provider: CalendarProvider;
  providerAccountEmail: string;
  status: string;
  connectedAt: string;
}

export async function connectCalendar(
  deps: ToolDeps,
  input: ConnectCalendarInput
): Promise<ConnectCalendarResult> {
  const adapter = deps.adapters(input.provider);

  const tokens = await adapter.exchangeCode({
    code: input.authorizationCode,
    redirectUri: input.redirectUri,
  });

  // The schema's `refresh_token_encrypted` is NOT NULL and a connection
  // without one is unusable past the first hour, so this is a hard failure
  // rather than a nullable column. Both adapters already reject this case
  // with a scope-specific message; this is the belt-and-braces check.
  if (!tokens.refreshToken) {
    throw new CalendarToolError(
      "PROVIDER_ERROR",
      `${input.provider} did not issue a refresh token; the consent request is missing its offline-access scope.`,
      { provider: input.provider }
    );
  }

  const providerAccountEmail = await adapter.getAccountEmail({
    accessToken: tokens.accessToken,
    tokens,
  });

  const connection = await deps.store.upsert({
    userId: input.freelancerId,
    provider: input.provider,
    providerAccountEmail,
    accessTokenEncrypted: encryptField(tokens.accessToken),
    refreshTokenEncrypted: encryptField(tokens.refreshToken),
    tokenExpiresAt: tokens.expiresAt,
    scope: tokens.scope ?? adapter.scopes.join(" "),
    // Null means "the account's default calendar". A calendar picker is a
    // later product decision; both adapters resolve null to primary/default.
    externalCalendarId: null,
  });

  return {
    provider: connection.provider,
    providerAccountEmail: connection.providerAccountEmail,
    status: connection.status,
    connectedAt: connection.connectedAt.toISOString(),
  };
}

// ───────────────────────────── get_availability ─────────────────────────────

export interface GetAvailabilityInput {
  freelancerId: string;
  provider: CalendarProvider;
  /** UTC lower bound (inclusive). The caller converts from the freelancer's local window. */
  dateRangeStart: string;
  /** UTC upper bound (exclusive). */
  dateRangeEnd: string;
  durationMinutes: number;
  bufferMinutes: number;
}

export interface GetAvailabilityResult {
  provider: CalendarProvider;
  /** ISO-8601 UTC instants, matching the API contract's `slots: ["2026-08-20T14:00:00Z", …]`. */
  slots: { start: string; end: string }[];
}

export async function getAvailability(
  deps: ToolDeps,
  input: GetAvailabilityInput
): Promise<GetAvailabilityResult> {
  const rangeStart = parseInstant(input.dateRangeStart, "dateRangeStart");
  const rangeEnd = parseInstant(input.dateRangeEnd, "dateRangeEnd");
  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    throw new CalendarToolError("INVALID_ARGUMENT", "dateRangeEnd must be after dateRangeStart.");
  }

  const connection = await requireConnection(deps, input.freelancerId, input.provider);
  const adapter = deps.adapters(input.provider);

  const busy = await withAccessToken(
    { store: deps.store, adapter, connection, now: nowOf(deps) },
    (accessToken) =>
      adapter.getBusyIntervals({
        accessToken,
        calendarId: connection.externalCalendarId,
        accountEmail: connection.providerAccountEmail,
        start: rangeStart,
        end: rangeEnd,
      })
  );

  await deps.store.touchLastSyncedAt(connection.id, nowOf(deps));

  const slots: Slot[] = computeAvailableSlots({
    rangeStart,
    rangeEnd,
    durationMinutes: input.durationMinutes,
    bufferMinutes: input.bufferMinutes,
    busy,
  });

  return {
    provider: input.provider,
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
  };
}

// ─────────────────────────── create_booking_event ───────────────────────────

export interface CreateBookingEventInput {
  freelancerId: string;
  provider: CalendarProvider;
  slotStart: string;
  slotEnd: string;
  prospectName: string;
  prospectEmail: string;
  notes?: string;
}

export interface CreateBookingEventResult {
  provider: CalendarProvider;
  providerEventId: string;
  slotStart: string;
  slotEnd: string;
}

export async function createBookingEvent(
  deps: ToolDeps,
  input: CreateBookingEventInput
): Promise<CreateBookingEventResult> {
  const slotStart = parseInstant(input.slotStart, "slotStart");
  const slotEnd = parseInstant(input.slotEnd, "slotEnd");
  if (slotEnd.getTime() <= slotStart.getTime()) {
    throw new CalendarToolError("INVALID_ARGUMENT", "slotEnd must be after slotStart.");
  }

  const connection = await requireConnection(deps, input.freelancerId, input.provider);
  const adapter = deps.adapters(input.provider);

  return withAccessToken(
    { store: deps.store, adapter, connection, now: nowOf(deps) },
    async (accessToken) => {
      // ── Re-check before write ──
      // app_spec.md's risk list: "two prospects hitting the public booking
      // page for the same slot simultaneously must be handled with a
      // re-check-before-write". Availability may have been computed
      // minutes ago, on a page the prospect left open. So the busy set is
      // re-fetched for *just this slot's range* (cheap — one narrow
      // free/busy query) immediately before the insert, and the write is
      // abandoned if anything now overlaps.
      //
      // This narrows the window to the round-trip between this check and
      // the insert; it does not close it, because neither provider offers
      // a conditional/compare-and-set event insert. Closing it fully would
      // need a local lock over (user, slot) in Postgres — which is
      // `bookings`' job in Stage 3, where the booking row is written, not
      // this service's. The provider-side check is the half that only this
      // service can do.
      const busy = await adapter.getBusyIntervals({
        accessToken,
        calendarId: connection.externalCalendarId,
        accountEmail: connection.providerAccountEmail,
        start: slotStart,
        end: slotEnd,
      });

      if (!isSlotStillFree(slotStart, slotEnd, busy)) {
        // Distinct, stable code — Stage 3 maps SLOT_TAKEN to 409 CONFLICT
        // without string-matching a message.
        throw new SlotTakenError(slotStart, slotEnd);
      }

      const { eventId } = await adapter.insertEvent({
        accessToken,
        calendarId: connection.externalCalendarId,
        start: slotStart,
        end: slotEnd,
        summary: `FreeOps booking — ${input.prospectName}`,
        description: input.notes,
        attendeeName: input.prospectName,
        attendeeEmail: input.prospectEmail,
      });

      return {
        provider: input.provider,
        providerEventId: eventId,
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
      };
    }
  );
}

// ────────────────────────────── delete_event ────────────────────────────────

export interface DeleteEventInput {
  freelancerId: string;
  provider: CalendarProvider;
  providerEventId: string;
}

export async function deleteEvent(
  deps: ToolDeps,
  input: DeleteEventInput
): Promise<{ provider: CalendarProvider; providerEventId: string; deleted: true }> {
  const connection = await requireConnection(deps, input.freelancerId, input.provider);
  const adapter = deps.adapters(input.provider);

  await withAccessToken(
    { store: deps.store, adapter, connection, now: nowOf(deps) },
    (accessToken) =>
      adapter.deleteEvent({
        accessToken,
        calendarId: connection.externalCalendarId,
        eventId: input.providerEventId,
      })
  );

  return { provider: input.provider, providerEventId: input.providerEventId, deleted: true };
}

// ────────────────────────── get_connection_status ───────────────────────────

export interface ConnectionStatusEntry {
  provider: CalendarProvider;
  providerAccountEmail: string;
  status: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  /** Convenience for the caller's "needs reconnect" prompt. */
  tokenExpiresAt: string | null;
}

export interface GetConnectionStatusResult {
  connections: ConnectionStatusEntry[];
}

export async function getConnectionStatus(
  deps: ToolDeps,
  input: { freelancerId: string }
): Promise<GetConnectionStatusResult> {
  const connections = await deps.store.listByUser(input.freelancerId);
  return {
    // Returns EVERY connected provider, not "the" connection: the unique
    // constraint is on (user_id, provider), so a freelancer may legitimately
    // have both. Choosing the active booking calendar is a Stage 2/3
    // product decision, deliberately not made here.
    //
    // Note the `status` values are the DB's own (active | revoked | error).
    // The API contract's `"connected" | "expired" | "disconnected"`
    // vocabulary is a response-layer translation Stage 3 applies; this
    // service reports what is actually stored.
    connections: connections.map((c) => ({
      provider: c.provider,
      providerAccountEmail: c.providerAccountEmail,
      status: c.status,
      connectedAt: c.connectedAt.toISOString(),
      lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
      tokenExpiresAt: c.tokenExpiresAt ? c.tokenExpiresAt.toISOString() : null,
    })),
  };
}
