import { describe, expect, it } from "vitest";

import type {
  LocationBusinessHoursPeriodDto,
  LocationDto,
} from "@/types/locations";

import { getOpenStatus } from "./open-status";

const TZ = "America/Los_Angeles";

function makeLocation(
  businessHours: readonly LocationBusinessHoursPeriodDto[] | null,
  timezone: string | null = TZ,
): LocationDto {
  return {
    id: "LOCATION1",
    name: "Downtown Cafe",
    address: null,
    timezone,
    businessHours,
    status: "ACTIVE",
  };
}

function period(
  dayOfWeek: LocationBusinessHoursPeriodDto["dayOfWeek"],
  startLocalTime: string,
  endLocalTime: string,
): LocationBusinessHoursPeriodDto {
  return { dayOfWeek, startLocalTime, endLocalTime };
}

// Fixed instants; America/Los_Angeles is PST (UTC-8) in January, no DST.
const MON_NOON = new Date("2025-01-06T20:00:00Z"); // Mon 12:00 local
const MON_0700 = new Date("2025-01-06T15:00:00Z"); // Mon 07:00 local
const MON_1230 = new Date("2025-01-06T20:30:00Z"); // Mon 12:30 local
const MON_1400 = new Date("2025-01-06T22:00:00Z"); // Mon 14:00 local
const MON_1800 = new Date("2025-01-07T02:00:00Z"); // Mon 18:00 local
const FRI_2300 = new Date("2025-01-11T07:00:00Z"); // Fri 23:00 local
const SAT_0100 = new Date("2025-01-11T09:00:00Z"); // Sat 01:00 local

describe("getOpenStatus", () => {
  it("reports open with the period close label", () => {
    const status = getOpenStatus(
      makeLocation([period("MON", "09:00:00", "17:00:00")]),
      MON_NOON,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "5:00 PM" });
  });

  it("reports closed with a same-day opening (no day label) before opening", () => {
    const status = getOpenStatus(
      makeLocation([period("MON", "09:00:00", "17:00:00")]),
      MON_0700,
    );

    expect(status).toEqual({
      kind: "closed",
      opensAtLabel: "9:00 AM",
      opensDayLabel: null,
    });
  });

  it("reports closed with next-day opening and a weekday label after closing", () => {
    const status = getOpenStatus(
      makeLocation([
        period("MON", "09:00:00", "17:00:00"),
        period("TUE", "08:00:00", "16:00:00"),
      ]),
      MON_1800,
    );

    expect(status).toEqual({
      kind: "closed",
      opensAtLabel: "8:00 AM",
      opensDayLabel: "Tue",
    });
  });

  it("labels a multi-day-away opening with its short weekday", () => {
    const status = getOpenStatus(
      makeLocation([period("WED", "09:00:00", "17:00:00")]),
      MON_NOON,
    );

    expect(status).toEqual({
      kind: "closed",
      opensAtLabel: "9:00 AM",
      opensDayLabel: "Wed",
    });
  });

  it("treats an overnight period as open before midnight on its day", () => {
    const status = getOpenStatus(
      makeLocation([period("FRI", "22:00:00", "02:00:00")]),
      FRI_2300,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "2:00 AM" });
  });

  it("treats an overnight period as open after midnight on the following day", () => {
    const status = getOpenStatus(
      makeLocation([period("FRI", "22:00:00", "02:00:00")]),
      SAT_0100,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "2:00 AM" });
  });

  it("supports multiple periods per day, closed within the midday gap", () => {
    const status = getOpenStatus(
      makeLocation([
        period("MON", "09:00:00", "12:00:00"),
        period("MON", "13:00:00", "17:00:00"),
      ]),
      MON_1230,
    );

    expect(status).toEqual({
      kind: "closed",
      opensAtLabel: "1:00 PM",
      opensDayLabel: null,
    });
  });

  it("supports multiple periods per day, open within the second period", () => {
    const status = getOpenStatus(
      makeLocation([
        period("MON", "09:00:00", "12:00:00"),
        period("MON", "13:00:00", "17:00:00"),
      ]),
      MON_1400,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "5:00 PM" });
  });

  it("skips malformed periods and honors the remaining valid ones", () => {
    const status = getOpenStatus(
      makeLocation([
        period("MON", "24:99", "10:00"),
        period("MON", "09:00:00", "17:00:00"),
      ]),
      MON_NOON,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "5:00 PM" });
  });

  it("formats 12-hour labels without leading zeros and with minutes", () => {
    const closes = getOpenStatus(
      makeLocation([period("MON", "08:00:00", "21:00:00")]),
      MON_NOON,
    );
    expect(closes).toEqual({ kind: "open", closesAtLabel: "9:00 PM" });

    const opens = getOpenStatus(
      makeLocation([period("MON", "07:30:00", "12:00:00")]),
      MON_0700,
    );
    expect(opens).toEqual({
      kind: "closed",
      opensAtLabel: "7:30 AM",
      opensDayLabel: null,
    });
  });

  it("accepts HH:MM period strings without seconds", () => {
    const status = getOpenStatus(
      makeLocation([period("MON", "09:00", "17:00")]),
      MON_NOON,
    );

    expect(status).toEqual({ kind: "open", closesAtLabel: "5:00 PM" });
  });

  it.each([
    ["null business hours", makeLocation(null)],
    ["empty business hours", makeLocation([])],
    ["null timezone", makeLocation([period("MON", "09:00:00", "17:00:00")], null)],
    [
      "invalid timezone",
      makeLocation([period("MON", "09:00:00", "17:00:00")], "Not/AZone"),
    ],
    [
      "only malformed periods",
      makeLocation([period("MON", "24:00", "30:00")]),
    ],
  ])("returns unknown for %s", (_, location) => {
    expect(getOpenStatus(location, MON_NOON)).toEqual({ kind: "unknown" });
  });
});
