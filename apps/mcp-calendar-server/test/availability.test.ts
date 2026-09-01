/**
 * Slot-arithmetic tests, including the two cases app_spec.md's risk list
 * asks for by name: a DST transition and a UTC day boundary.
 *
 * The suite runs with `TZ=America/Bogota` (see `test/setup.ts`), so any
 * regression that reintroduces local-calendar math fails here rather than
 * only on a developer's machine in a different zone.
 */
import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  isSlotStillFree,
  mergeBusyIntervals,
} from "../src/availability.js";

const iso = (slots: { start: Date; end: Date }[]) => slots.map((s) => s.start.toISOString());

/** Offset of `zone` from UTC, in ms, at the given instant. */
function zoneOffsetMs(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asIfUtc - at.getTime();
}

/**
 * Converts a local wall-clock time in `zone` into the UTC instant it
 * denotes — i.e. exactly the conversion the *caller* of `get_availability`
 * is responsible for (the freelancer's window lives in
 * `booking_links.availability_rules`, which this service deliberately
 * doesn't read). Used here to pin that contract from the caller's side.
 */
function zonedWallClockToUtc(
  zone: string,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi = 0
): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let ts = naive - zoneOffsetMs(zone, new Date(naive));
  ts = naive - zoneOffsetMs(zone, new Date(ts));
  return new Date(ts);
}

describe("mergeBusyIntervals", () => {
  it("sorts, merges overlaps, and coalesces adjacent blocks", () => {
    const merged = mergeBusyIntervals([
      { start: new Date("2026-08-20T12:00:00Z"), end: new Date("2026-08-20T13:00:00Z") },
      { start: new Date("2026-08-20T09:00:00Z"), end: new Date("2026-08-20T10:30:00Z") },
      { start: new Date("2026-08-20T10:00:00Z"), end: new Date("2026-08-20T11:00:00Z") },
      // adjacent, not overlapping — must still coalesce
      { start: new Date("2026-08-20T13:00:00Z"), end: new Date("2026-08-20T14:00:00Z") },
    ]);

    expect(merged.map((m) => [m.start.toISOString(), m.end.toISOString()])).toEqual([
      ["2026-08-20T09:00:00.000Z", "2026-08-20T11:00:00.000Z"],
      ["2026-08-20T12:00:00.000Z", "2026-08-20T14:00:00.000Z"],
    ]);
  });

  it("drops zero-length and inverted intervals", () => {
    expect(
      mergeBusyIntervals([
        { start: new Date("2026-08-20T09:00:00Z"), end: new Date("2026-08-20T09:00:00Z") },
        { start: new Date("2026-08-20T11:00:00Z"), end: new Date("2026-08-20T10:00:00Z") },
      ])
    ).toEqual([]);
  });
});

describe("computeAvailableSlots — basics", () => {
  it("slices an empty calendar into contiguous slots", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T16:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    });
    expect(iso(slots)).toEqual([
      "2026-08-20T14:00:00.000Z",
      "2026-08-20T14:30:00.000Z",
      "2026-08-20T15:00:00.000Z",
      "2026-08-20T15:30:00.000Z",
    ]);
  });

  it("drops a trailing slot that doesn't fit inside the range", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T15:20:00Z"),
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    });
    // 14:00, 14:30 fit; 15:00–15:30 would run past 15:20.
    expect(iso(slots)).toEqual(["2026-08-20T14:00:00.000Z", "2026-08-20T14:30:00.000Z"]);
  });

  it("excludes slots overlapping a busy interval, including partial overlap", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T16:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 0,
      // Overlaps 14:30–15:00 partially and 15:00–15:30 partially.
      busy: [{ start: new Date("2026-08-20T14:45:00Z"), end: new Date("2026-08-20T15:15:00Z") }],
    });
    expect(iso(slots)).toEqual(["2026-08-20T14:00:00.000Z", "2026-08-20T15:30:00.000Z"]);
  });

  it("treats busy boundaries as half-open (a slot may start exactly when busy ends)", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T15:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [{ start: new Date("2026-08-20T13:00:00Z"), end: new Date("2026-08-20T14:30:00Z") }],
    });
    expect(iso(slots)).toEqual(["2026-08-20T14:30:00.000Z"]);
  });

  it("returns nothing for an empty or inverted range", () => {
    const args = {
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    };
    expect(
      computeAvailableSlots({
        ...args,
        rangeStart: new Date("2026-08-20T14:00:00Z"),
        rangeEnd: new Date("2026-08-20T14:00:00Z"),
      })
    ).toEqual([]);
    expect(
      computeAvailableSlots({
        ...args,
        rangeStart: new Date("2026-08-20T15:00:00Z"),
        rangeEnd: new Date("2026-08-20T14:00:00Z"),
      })
    ).toEqual([]);
  });

  it("rejects a non-positive duration", () => {
    expect(() =>
      computeAvailableSlots({
        rangeStart: new Date("2026-08-20T14:00:00Z"),
        rangeEnd: new Date("2026-08-20T16:00:00Z"),
        durationMinutes: 0,
        bufferMinutes: 0,
        busy: [],
      })
    ).toThrow(/positive/i);
  });
});

describe("computeAvailableSlots — buffer semantics", () => {
  it("spaces candidate slots by duration + buffer", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T16:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 15,
      busy: [],
    });
    // step = 45 min: 14:00, 14:45, 15:30 (15:30+30 = 16:00, fits exactly).
    expect(iso(slots)).toEqual([
      "2026-08-20T14:00:00.000Z",
      "2026-08-20T14:45:00.000Z",
      "2026-08-20T15:30:00.000Z",
    ]);
  });

  it("also keeps the buffer clear of existing calendar events", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-08-20T14:00:00Z"),
      rangeEnd: new Date("2026-08-20T17:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 15,
      // Sits in the 15-minute padding AFTER the 14:00–14:30 candidate and
      // BEFORE the 14:45–15:15 one, so both must be dropped even though
      // neither overlaps the meeting itself.
      busy: [{ start: new Date("2026-08-20T14:35:00Z"), end: new Date("2026-08-20T14:40:00Z") }],
    });
    expect(iso(slots)).toEqual([
      "2026-08-20T15:30:00.000Z",
      "2026-08-20T16:15:00.000Z",
    ]);
  });
});

describe("computeAvailableSlots — UTC day boundary", () => {
  it("runs straight through midnight UTC with no gap or duplicate", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-03-10T22:00:00Z"),
      rangeEnd: new Date("2026-03-11T02:00:00Z"),
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [],
    });
    expect(iso(slots)).toEqual([
      "2026-03-10T22:00:00.000Z",
      "2026-03-10T23:00:00.000Z",
      "2026-03-11T00:00:00.000Z",
      "2026-03-11T01:00:00.000Z",
    ]);
  });

  it("excludes a busy block that itself straddles midnight UTC", () => {
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-03-10T22:00:00Z"),
      rangeEnd: new Date("2026-03-11T02:00:00Z"),
      durationMinutes: 60,
      bufferMinutes: 0,
      busy: [{ start: new Date("2026-03-10T23:30:00Z"), end: new Date("2026-03-11T00:30:00Z") }],
    });
    expect(iso(slots)).toEqual(["2026-03-10T22:00:00.000Z", "2026-03-11T01:00:00.000Z"]);
  });
});

describe("computeAvailableSlots — DST transition", () => {
  // US Eastern springs forward on 2026-03-08 at 02:00 local
  // (= 2026-03-08T07:00:00Z): the local clock jumps 02:00 → 03:00 and the
  // offset moves from UTC-5 (EST) to UTC-4 (EDT).
  const TRANSITION_UTC = new Date("2026-03-08T07:00:00Z");

  it("pins the transition this suite is built on", () => {
    expect(zoneOffsetMs("America/New_York", new Date(TRANSITION_UTC.getTime() - 60_000))).toBe(
      -5 * 60 * 60 * 1000
    );
    expect(zoneOffsetMs("America/New_York", new Date(TRANSITION_UTC.getTime() + 60_000))).toBe(
      -4 * 60 * 60 * 1000
    );
  });

  it("slices continuously across the spring-forward instant", () => {
    // 06:00Z → 09:00Z spans the 07:00Z transition. In UTC nothing special
    // happens, and that is exactly the point: no hour is skipped, none is
    // repeated. Local-calendar arithmetic would produce one or the other.
    const slots = computeAvailableSlots({
      rangeStart: new Date("2026-03-08T06:00:00Z"),
      rangeEnd: new Date("2026-03-08T09:00:00Z"),
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    });
    expect(iso(slots)).toEqual([
      "2026-03-08T06:00:00.000Z",
      "2026-03-08T06:30:00.000Z",
      "2026-03-08T07:00:00.000Z",
      "2026-03-08T07:30:00.000Z",
      "2026-03-08T08:00:00.000Z",
      "2026-03-08T08:30:00.000Z",
    ]);
    // Every consecutive pair is exactly 30 real minutes apart.
    for (let i = 1; i < slots.length; i += 1) {
      const prev = slots[i - 1]!;
      const curr = slots[i]!;
      expect(curr.start.getTime() - prev.start.getTime()).toBe(30 * 60_000);
    }
  });

  it("keeps a 09:00–17:00 local window the same length either side of the transition, at different UTC instants", () => {
    const zone = "America/New_York";

    // Saturday 2026-03-07, still EST (UTC-5): 09:00 local = 14:00Z.
    const beforeStart = zonedWallClockToUtc(zone, 2026, 3, 7, 9);
    const beforeEnd = zonedWallClockToUtc(zone, 2026, 3, 7, 17);
    // Sunday 2026-03-08, now EDT (UTC-4): 09:00 local = 13:00Z.
    const afterStart = zonedWallClockToUtc(zone, 2026, 3, 8, 9);
    const afterEnd = zonedWallClockToUtc(zone, 2026, 3, 8, 17);

    expect(beforeStart.toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(afterStart.toISOString()).toBe("2026-03-08T13:00:00.000Z");

    const before = computeAvailableSlots({
      rangeStart: beforeStart,
      rangeEnd: beforeEnd,
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    });
    const after = computeAvailableSlots({
      rangeStart: afterStart,
      rangeEnd: afterEnd,
      durationMinutes: 30,
      bufferMinutes: 0,
      busy: [],
    });

    // The freelancer offers the same eight working hours on both days …
    expect(before).toHaveLength(16);
    expect(after).toHaveLength(16);
    // … but the second day's slots sit one hour earlier in UTC. A naive
    // "same UTC offset every day" implementation would put them at 14:00Z
    // and quietly book everyone an hour late.
    expect(after[0]!.start.toISOString()).toBe("2026-03-08T13:00:00.000Z");
    expect(before[0]!.start.toISOString()).toBe("2026-03-07T14:00:00.000Z");
  });

  it("is unaffected in a zone without DST (Colombia is always UTC-5)", () => {
    const zone = "America/Bogota";
    expect(zonedWallClockToUtc(zone, 2026, 3, 7, 9).toISOString()).toBe(
      "2026-03-07T14:00:00.000Z"
    );
    expect(zonedWallClockToUtc(zone, 2026, 3, 8, 9).toISOString()).toBe(
      "2026-03-08T14:00:00.000Z"
    );
    expect(zonedWallClockToUtc(zone, 2026, 8, 20, 9).toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
  });
});

describe("isSlotStillFree", () => {
  it("is true when nothing overlaps", () => {
    expect(
      isSlotStillFree(new Date("2026-08-20T14:00:00Z"), new Date("2026-08-20T14:30:00Z"), [
        { start: new Date("2026-08-20T15:00:00Z"), end: new Date("2026-08-20T16:00:00Z") },
      ])
    ).toBe(true);
  });

  it("is false for even a one-minute overlap", () => {
    expect(
      isSlotStillFree(new Date("2026-08-20T14:00:00Z"), new Date("2026-08-20T14:30:00Z"), [
        { start: new Date("2026-08-20T14:29:00Z"), end: new Date("2026-08-20T15:00:00Z") },
      ])
    ).toBe(false);
  });

  it("treats a busy block that ends exactly at the slot start as free", () => {
    expect(
      isSlotStillFree(new Date("2026-08-20T14:00:00Z"), new Date("2026-08-20T14:30:00Z"), [
        { start: new Date("2026-08-20T13:00:00Z"), end: new Date("2026-08-20T14:00:00Z") },
      ])
    ).toBe(true);
  });
});
