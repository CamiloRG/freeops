/**
 * Slot arithmetic — pure functions, no I/O, no provider knowledge.
 *
 * app_spec.md's honest-risk list names timezone/DST handling as "the
 * single most common source of subtle bugs in DIY scheduling tools" and
 * asks for explicit test coverage rather than happy-path testing. The
 * defence used here is to make this module incapable of getting it wrong:
 *
 *  1. **Everything is a UTC instant.** All arithmetic is done on
 *     `Date.getTime()` epoch milliseconds. No calendar-field math (no
 *     `setHours`, no date-part addition), so there is no local calendar
 *     for a DST transition to distort. A "day" is never assumed to be
 *     86,400,000 ms; days as such simply do not appear here.
 *  2. **Local wall-clock never enters this module.** The freelancer's
 *     availability window ("Mon–Fri 09:00–17:00 America/Bogota") lives in
 *     `booking_links.availability_rules`, which is main-app domain. The
 *     caller converts that window into UTC bounds and passes them in.
 *     That is precisely why a DST transition matters to the *caller* and
 *     not to us: 09:00 local is a different UTC instant either side of a
 *     transition, and only the caller knows the zone. See the DST test in
 *     `test/availability.test.ts`, which pins that contract from the
 *     caller's side.
 *  3. The schema's columns are `timestamptz` (UTC-native), so what is
 *     computed here is what is stored, with no conversion in between.
 */
import type { BusyInterval } from "./providers/types.js";

export interface Slot {
  start: Date;
  end: Date;
}

export interface ComputeSlotsParams {
  /** Inclusive lower bound of the search window (UTC instant). */
  rangeStart: Date;
  /** Exclusive upper bound of the search window (UTC instant). */
  rangeEnd: Date;
  /** Meeting length. Comes from `booking_links.duration_minutes`, passed in by the caller. */
  durationMinutes: number;
  /** Padding around meetings. From `booking_links.buffer_minutes`. May be 0. */
  bufferMinutes: number;
  /** Busy intervals from the provider; may overlap each other and may be unsorted. */
  busy: BusyInterval[];
}

const MINUTE_MS = 60_000;

/**
 * Sorts and merges overlapping/adjacent busy intervals into a minimal
 * disjoint set. Both providers can return overlapping items (Google
 * returns one block per calendar; Graph returns one `scheduleItem` per
 * event, and events overlap freely), so nothing downstream should assume
 * disjointness.
 */
export function mergeBusyIntervals(busy: BusyInterval[]): BusyInterval[] {
  const sorted = busy
    .filter((b) => b.end.getTime() > b.start.getTime())
    .map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    // `>=` merges adjacent blocks too (10:00–11:00 + 11:00–12:00 → 10:00–12:00),
    // which keeps the overlap test below from seeing a zero-width gap as free.
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged.map((m) => ({ start: new Date(m.start), end: new Date(m.end) }));
}

/** Half-open overlap test: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Slices [rangeStart, rangeEnd) into bookable slots.
 *
 * Buffer semantics (documented because "buffer" is ambiguous in
 * scheduling products, and the spec only says "applying the freelancer's
 * configured meeting length + buffer"):
 *
 *   - **Spacing**: candidate slots are laid out every
 *     `durationMinutes + bufferMinutes`, starting at `rangeStart`, so two
 *     bookings taken from one availability run can never end up
 *     back-to-back with no gap.
 *   - **Padding**: a candidate is discarded when the busy set intersects
 *     its buffered footprint `[start - buffer, end + buffer)`, not merely
 *     the meeting itself — otherwise a buffer would protect the freelancer
 *     from FreeOps bookings but not from the meetings already on their
 *     calendar, which is the case the buffer exists for.
 *
 * With `bufferMinutes: 0` (the schema default) both rules collapse to the
 * obvious behaviour: contiguous slots, excluded iff they overlap a busy
 * interval.
 *
 * A slot is only returned when it fits entirely inside the range; partial
 * trailing slots are dropped.
 */
export function computeAvailableSlots(params: ComputeSlotsParams): Slot[] {
  const { rangeStart, rangeEnd, durationMinutes, bufferMinutes, busy } = params;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error(`durationMinutes must be a positive number, got ${durationMinutes}.`);
  }
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    throw new Error(`bufferMinutes must be zero or positive, got ${bufferMinutes}.`);
  }

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  if (Number.isNaN(rangeStartMs) || Number.isNaN(rangeEndMs)) {
    throw new Error("rangeStart/rangeEnd must be valid dates.");
  }
  if (rangeEndMs <= rangeStartMs) return [];

  const durationMs = durationMinutes * MINUTE_MS;
  const bufferMs = bufferMinutes * MINUTE_MS;
  const stepMs = durationMs + bufferMs;

  const merged = mergeBusyIntervals(busy);
  const slots: Slot[] = [];

  for (let startMs = rangeStartMs; startMs + durationMs <= rangeEndMs; startMs += stepMs) {
    const endMs = startMs + durationMs;
    const paddedStart = startMs - bufferMs;
    const paddedEnd = endMs + bufferMs;

    const isBusy = merged.some((b) =>
      overlaps(paddedStart, paddedEnd, b.start.getTime(), b.end.getTime())
    );
    if (!isBusy) {
      slots.push({ start: new Date(startMs), end: new Date(endMs) });
    }
  }

  return slots;
}

/**
 * True when [slotStart, slotEnd) is entirely free given `busy`.
 *
 * Used by the re-check-before-write guard in `create_booking_event`.
 * Deliberately unbuffered: the buffer is an availability-*presentation*
 * rule, and re-applying it at write time would reject a slot the prospect
 * was legitimately offered whenever an unrelated meeting landed in the
 * padding in between. The race this guard exists to catch is a genuine
 * overlap of the meeting itself.
 */
export function isSlotStillFree(slotStart: Date, slotEnd: Date, busy: BusyInterval[]): boolean {
  const startMs = slotStart.getTime();
  const endMs = slotEnd.getTime();
  return !mergeBusyIntervals(busy).some((b) =>
    overlaps(startMs, endMs, b.start.getTime(), b.end.getTime())
  );
}
