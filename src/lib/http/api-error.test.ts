import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/lib/errors/application-error";

import { toApiErrorResponse, toPublicErrorDetails } from "./api-error";

describe("API error mapping", () => {
  it("maps an ApplicationError using only its public fields", async () => {
    const error = new ApplicationError({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 503,
      message: "upstream diagnostic with fake-sensitive-context",
      publicMessage: "Menu data is temporarily unavailable.",
      cause: new Error("fake-upstream-body"),
    });

    const response = toApiErrorResponse(error, "request-123");

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(await response.json()).toEqual({
      error: {
        code: "SQUARE_UNAVAILABLE",
        message: "Menu data is temporarily unavailable.",
        requestId: "request-123",
      },
    });
  });

  it("sanitizes unknown errors and does not expose their message", async () => {
    const response = toApiErrorResponse(
      new Error("fake-secret-or-upstream-detail"),
    );
    const serializedBody = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(JSON.parse(serializedBody)).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    expect(serializedBody).not.toContain("fake-secret-or-upstream-detail");
  });

  it("returns typed details separately from Response construction", () => {
    const details = toPublicErrorDetails("not even an Error", "request-456");

    expect(details).toEqual({
      statusCode: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
          requestId: "request-456",
        },
      },
    });
  });
});
