/**
 * The one piece of Microsoft-specific parsing that is pure enough to test
 * without a live Graph account — and the piece most likely to silently
 * corrupt every busy interval if it regresses.
 *
 * Graph returns `{ dateTime: "2026-08-20T14:00:00.0000000", timeZone: "UTC" }`:
 * an ISO-ish string with NO offset suffix, plus the zone in a sibling
 * field. `new Date(thatString)` alone parses it in the HOST's local zone —
 * on this suite's `TZ=America/Bogota` that would shift every interval by
 * five hours, offering prospects slots the freelancer is actually in
 * meetings for. That is precisely the timezone bug class app_spec.md
 * flags, so it gets its own tests.
 */
import { describe, expect, it } from "vitest";
import { parseGraphDateTime } from "../src/providers/microsoft.js";

describe("parseGraphDateTime", () => {
  it("treats a naive dateTime with timeZone UTC as UTC, not as host-local time", () => {
    const parsed = parseGraphDateTime({
      dateTime: "2026-08-20T14:00:00.0000000",
      timeZone: "UTC",
    });
    expect(parsed?.toISOString()).toBe("2026-08-20T14:00:00.000Z");
  });

  it("defaults a missing timeZone to UTC", () => {
    expect(parseGraphDateTime({ dateTime: "2026-08-20T14:00:00" })?.toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
  });

  it("honours an explicit offset when Graph supplies one", () => {
    expect(parseGraphDateTime({ dateTime: "2026-08-20T14:00:00Z" })?.toISOString()).toBe(
      "2026-08-20T14:00:00.000Z"
    );
    expect(
      parseGraphDateTime({ dateTime: "2026-08-20T09:00:00-05:00" })?.toISOString()
    ).toBe("2026-08-20T14:00:00.000Z");
  });

  it("throws rather than guessing when Graph answers in an unexpected zone", () => {
    // We always request UTC; a different zone means the response
    // contradicts the request, and guessing would reintroduce the bug.
    expect(() =>
      parseGraphDateTime({ dateTime: "2026-08-20T14:00:00", timeZone: "Pacific Standard Time" })
    ).toThrow(/UTC/);
  });

  it("returns null for a missing dateTime", () => {
    expect(parseGraphDateTime({})).toBeNull();
  });
});
