import { SquareError, SquareTimeoutError } from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toApiErrorResponse } from "@/lib/http/api-error";

import {
  mapSquareResponseErrors,
  mapSquareUpstreamError,
} from "./square-error";

describe("Square upstream error mapping", () => {
  it.each([401, 403])(
    "maps Square HTTP %i to a clean authentication error",
    async (statusCode) => {
      const mapped = mapSquareUpstreamError(
        new SquareError({
          statusCode,
          message: "fake-raw-auth-message",
          body: { token: "fake-secret" },
        }),
      );
      const response = toApiErrorResponse(mapped, "request-auth");
      const serialized = await response.text();

      expect(mapped).toMatchObject({
        code: "SQUARE_AUTHENTICATION_ERROR",
        statusCode: 502,
      });
      expect(serialized).not.toContain("fake-raw-auth-message");
      expect(serialized).not.toContain("fake-secret");
    },
  );

  it("maps HTTP 429 and typed RATE_LIMITED response errors", () => {
    expect(
      mapSquareUpstreamError(
        new SquareError({ statusCode: 429, message: "fake-rate-detail" }),
      ),
    ).toMatchObject({ code: "SQUARE_RATE_LIMITED", statusCode: 503 });

    expect(
      mapSquareResponseErrors([{ code: "RATE_LIMITED" }]),
    ).toMatchObject({ code: "SQUARE_RATE_LIMITED", statusCode: 503 });
  });

  it("maps typed authentication response errors without a status code", () => {
    expect(
      mapSquareResponseErrors([{ code: "UNAUTHORIZED" }]),
    ).toMatchObject({
      code: "SQUARE_AUTHENTICATION_ERROR",
      statusCode: 502,
    });
  });

  it.each([
    new SquareError({ statusCode: 500, message: "fake-upstream-detail" }),
    new SquareTimeoutError("fake-timeout-detail"),
    new TypeError("fake-network-detail"),
  ])("maps generic SDK and network failures to unavailable", (error) => {
    const mapped = mapSquareUpstreamError(error);

    expect(mapped).toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 503,
      publicMessage: "Location data is temporarily unavailable.",
    });
    expect(mapped.message).not.toContain("fake-");
  });
});
