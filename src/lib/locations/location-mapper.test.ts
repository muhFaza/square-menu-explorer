import type { Location } from "square";
import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/lib/errors/application-error";

import { mapActiveLocations } from "./location-mapper";

describe("mapActiveLocations", () => {
  it("keeps only active locations and maps a stable structured DTO", () => {
    const result = mapActiveLocations([
      {
        id: " inactive-id ",
        name: "Closed cafe",
        status: "INACTIVE",
      },
      {
        id: " active-id ",
        name: " Main cafe ",
        status: "ACTIVE",
        timezone: " America/New_York ",
        address: {
          addressLine1: " 10 Main Street ",
          addressLine2: "   ",
          locality: " Brooklyn ",
          administrativeDistrictLevel1: " NY ",
          postalCode: " 11201 ",
          country: "US",
        },
        businessHours: {
          periods: [
            {
              dayOfWeek: "MON",
              startLocalTime: "08:00:00",
              endLocalTime: "17:00:00",
            },
          ],
        },
      },
      {
        id: "status-missing",
        name: "Unknown status",
      },
    ]);

    expect(result).toEqual([
      {
        id: "active-id",
        name: "Main cafe",
        address: {
          addressLine1: "10 Main Street",
          addressLine2: null,
          addressLine3: null,
          locality: "Brooklyn",
          sublocality: null,
          administrativeDistrictLevel1: "NY",
          administrativeDistrictLevel2: null,
          postalCode: "11201",
          country: "US",
        },
        timezone: "America/New_York",
        businessHours: [
          {
            dayOfWeek: "MON",
            startLocalTime: "08:00:00",
            endLocalTime: "17:00:00",
          },
        ],
        status: "ACTIVE",
      },
    ]);
  });

  it("maps missing optional address and timezone to null", () => {
    expect(
      mapActiveLocations([
        { id: "location-id", name: "Cafe", status: "ACTIVE" },
      ]),
    ).toEqual([
      {
        id: "location-id",
        name: "Cafe",
        address: null,
        timezone: null,
        businessHours: null,
        status: "ACTIVE",
      },
    ]);
  });

  it("maps and skips business hours periods with missing or invalid fields", () => {
    const [location] = mapActiveLocations([
      {
        id: "location-id",
        name: "Cafe",
        status: "ACTIVE",
        businessHours: {
          periods: [
            {
              dayOfWeek: "TUE",
              startLocalTime: " 09:00:00 ",
              endLocalTime: " 21:00:00 ",
            },
            { dayOfWeek: "WED", startLocalTime: "10:00:00" },
            { startLocalTime: "10:00:00", endLocalTime: "18:00:00" },
            {
              dayOfWeek: "XYZ",
              startLocalTime: "10:00:00",
              endLocalTime: "18:00:00",
            },
          ],
        },
      },
    ] as unknown as Location[]);

    expect(location?.businessHours).toEqual([
      { dayOfWeek: "TUE", startLocalTime: "09:00:00", endLocalTime: "21:00:00" },
    ]);
  });

  it("maps business hours to null when no period is valid", () => {
    const [location] = mapActiveLocations([
      {
        id: "location-id",
        name: "Cafe",
        status: "ACTIVE",
        businessHours: { periods: [{ dayOfWeek: "MON" }] },
      },
    ]);

    expect(location?.businessHours).toBeNull();
  });

  it.each([
    ["id", { name: "Cafe", status: "ACTIVE" as const }],
    ["name", { id: "location-id", name: "   ", status: "ACTIVE" as const }],
  ])("fails cleanly when an active location is missing %s", (field, location) => {
    expect(() => mapActiveLocations([location])).toThrowError(
      expect.objectContaining({
        code: "SQUARE_UNAVAILABLE",
        statusCode: 502,
        publicMessage: "Location data is temporarily unavailable.",
        message: expect.stringContaining(`missing ${field}`),
      }) as ApplicationError,
    );
  });
});
