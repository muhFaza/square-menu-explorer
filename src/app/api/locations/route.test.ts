import { SquareError } from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { HttpRequestLog } from "@/lib/logging/request-logger";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";
import type { SquareLocationsClient } from "@/lib/square/locations-gateway";

import {
  createLocationsGetHandler,
  dynamic,
  runtime,
} from "./route";

function createTestGetHandler(
  list: () => Promise<Awaited<ReturnType<SquareLocationsClient["locations"]["list"]>>>,
  entries: HttpRequestLog[] = [],
) {
  const gateway = createSquareLocationsGateway(() => ({
    locations: { list },
  }));

  return createLocationsGetHandler({
    gateway,
    requestLogging: {
      clock: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(25),
      idFactory: () => "request-locations",
      sink: (entry) => entries.push(entry),
    },
  });
}

describe("GET /api/locations integration", () => {
  it("opts out of static rendering on the server-only Node.js runtime", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it("runs route, service, mapper, and gateway while returning active DTOs", async () => {
    const entries: HttpRequestLog[] = [];
    const list = vi.fn().mockResolvedValue({
      locations: [
        {
          id: "active-id",
          name: "Active cafe",
          status: "ACTIVE",
          timezone: null,
          address: { locality: "Bangkok", country: "TH" },
          businessHours: {
            periods: [
              {
                dayOfWeek: "FRI",
                startLocalTime: "07:00:00",
                endLocalTime: "22:00:00",
              },
            ],
          },
        },
        { id: "inactive-id", name: "Closed cafe", status: "INACTIVE" },
      ],
    });
    const get = createTestGetHandler(list, entries);

    const response = await get(
      new Request("https://example.test/api/locations?ignored=true"),
    );

    expect(list).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("x-request-id")).toBe("request-locations");
    expect(await response.json()).toEqual({
      locations: [
        {
          id: "active-id",
          name: "Active cafe",
          address: {
            addressLine1: null,
            addressLine2: null,
            addressLine3: null,
            locality: "Bangkok",
            sublocality: null,
            administrativeDistrictLevel1: null,
            administrativeDistrictLevel2: null,
            postalCode: null,
            country: "TH",
          },
          timezone: null,
          businessHours: [
            {
              dayOfWeek: "FRI",
              startLocalTime: "07:00:00",
              endLocalTime: "22:00:00",
            },
          ],
          status: "ACTIVE",
        },
      ],
    });
    expect(entries).toEqual([
      {
        event: "http_request",
        requestId: "request-locations",
        method: "GET",
        path: "/api/locations",
        statusCode: 200,
        durationMs: 15,
      },
    ]);
  });

  it("returns a successful empty list when Square omits locations", async () => {
    const response = await createTestGetHandler(async () => ({}))(
      new Request("https://example.test/api/locations"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locations: [] });
  });

  it("returns a clean 502 when active Square data lacks a required field", async () => {
    const response = await createTestGetHandler(async () => ({
      locations: [{ id: "location-id", status: "ACTIVE" }],
    }))(new Request("https://example.test/api/locations"));
    const serialized = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-locations");
    expect(JSON.parse(serialized)).toEqual({
      error: {
        code: "SQUARE_UNAVAILABLE",
        message: "Location data is temporarily unavailable.",
        requestId: "request-locations",
      },
    });
    expect(serialized).not.toContain("missing name");
  });

  it.each([
    {
      label: "authentication",
      error: new SquareError({
        statusCode: 401,
        message: "fake-auth-detail",
        body: { secret: "fake-secret" },
      }),
      expectedStatus: 502,
      expectedCode: "SQUARE_AUTHENTICATION_ERROR",
    },
    {
      label: "rate limit",
      error: new SquareError({
        statusCode: 429,
        message: "fake-rate-detail",
      }),
      expectedStatus: 503,
      expectedCode: "SQUARE_RATE_LIMITED",
    },
    {
      label: "network",
      error: new TypeError("fake-network-detail"),
      expectedStatus: 503,
      expectedCode: "SQUARE_UNAVAILABLE",
    },
  ])(
    "sanitizes a Square $label failure and logs the mapped status",
    async ({ error, expectedStatus, expectedCode }) => {
      const entries: HttpRequestLog[] = [];
      const get = createTestGetHandler(async () => {
        throw error;
      }, entries);

      const response = await get(
        new Request("https://example.test/api/locations"),
      );
      const serialized = await response.text();

      expect(response.status).toBe(expectedStatus);
      expect(JSON.parse(serialized)).toMatchObject({
        error: {
          code: expectedCode,
          requestId: "request-locations",
        },
      });
      expect(serialized).not.toContain("fake-");
      expect(entries[0]?.statusCode).toBe(expectedStatus);
    },
  );

  it("maps typed Square response errors instead of returning partial locations", async () => {
    const response = await createTestGetHandler(async () => ({
      errors: [{ category: "AUTHENTICATION_ERROR", code: "UNAUTHORIZED" }],
      locations: [{ id: "must-not-return", name: "Hidden", status: "ACTIVE" }],
    }))(new Request("https://example.test/api/locations"));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "SQUARE_AUTHENTICATION_ERROR" },
    });
  });
});
