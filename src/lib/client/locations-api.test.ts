import { describe, expect, it, vi } from "vitest";

import { fetchLocations, LocationsApiError } from "./locations-api";

const validLocation = {
  id: "LOCATION1",
  name: "Downtown Cafe",
  address: null,
  timezone: "America/Los_Angeles",
  businessHours: null,
  status: "ACTIVE",
} as const;

describe("fetchLocations", () => {
  it("requests the same-origin Locations endpoint and returns validated DTOs", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ locations: [validLocation] }),
    );
    const controller = new AbortController();

    await expect(
      fetchLocations({ fetcher, signal: controller.signal }),
    ).resolves.toEqual([validLocation]);
    expect(fetcher).toHaveBeenCalledWith("/api/locations", {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  });

  it("accepts the full nullable address contract", async () => {
    const address = {
      addressLine1: "123 Main St",
      addressLine2: null,
      addressLine3: null,
      locality: "Anytown",
      sublocality: null,
      administrativeDistrictLevel1: "CA",
      administrativeDistrictLevel2: null,
      postalCode: "90210",
      country: "US",
    };
    const fetcher = vi.fn(async () =>
      Response.json({ locations: [{ ...validLocation, address }] }),
    );

    await expect(fetchLocations({ fetcher })).resolves.toEqual([
      { ...validLocation, address },
    ]);
  });

  it("accepts locations carrying validated business hours periods", async () => {
    const businessHours = [
      { dayOfWeek: "MON", startLocalTime: "07:00:00", endLocalTime: "21:00:00" },
    ];
    const fetcher = vi.fn(async () =>
      Response.json({ locations: [{ ...validLocation, businessHours }] }),
    );

    await expect(fetchLocations({ fetcher })).resolves.toEqual([
      { ...validLocation, businessHours },
    ]);
  });

  it.each([
    ["non-success status", new Response(null, { status: 503 })],
    ["invalid JSON", new Response("not-json", { status: 200 })],
    ["malformed envelope", Response.json({ locations: "not-an-array" })],
    [
      "malformed location",
      Response.json({ locations: [{ ...validLocation, status: "INACTIVE" }] }),
    ],
    [
      "malformed business hours period",
      Response.json({
        locations: [
          {
            ...validLocation,
            businessHours: [{ dayOfWeek: "FUNDAY", startLocalTime: "07:00:00" }],
          },
        ],
      }),
    ],
  ])("rejects a %s with one stable browser-safe error", async (_, response) => {
    const fetcher = vi.fn(async () => response);

    await expect(fetchLocations({ fetcher })).rejects.toEqual(
      new LocationsApiError(),
    );
  });
});
