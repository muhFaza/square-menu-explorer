import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withRequestLogging, type HttpRequestLog } from "./request-logger";

describe("withRequestLogging", () => {
  it("passes request context and records only the sanitized request schema", async () => {
    const entries: HttpRequestLog[] = [];
    const clock = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(124.5);
    const handler = vi.fn(
      async (_request: Request, context: { requestId: string }) => {
        expect(context).toEqual({ requestId: "request-123" });
        return new Response(null, { status: 204 });
      },
    );
    const wrapped = withRequestLogging(handler, {
      clock,
      idFactory: () => "request-123",
      sink: (entry) => entries.push(entry),
    });

    const response = await wrapped(
      new Request("https://example.test/api/catalog?location_id=sensitive", {
        method: "GET",
        headers: { authorization: "fake-secret" },
      }),
    );

    expect(response.status).toBe(204);
    expect(entries).toEqual([
      {
        event: "http_request",
        requestId: "request-123",
        method: "GET",
        path: "/api/catalog",
        statusCode: 204,
        durationMs: 24.5,
      },
    ]);
    expect(Object.keys(entries[0] ?? {}).sort()).toEqual(
      [
        "durationMs",
        "event",
        "method",
        "path",
        "requestId",
        "statusCode",
      ].sort(),
    );
    expect(JSON.stringify(entries)).not.toContain("sensitive");
    expect(JSON.stringify(entries)).not.toContain("fake-secret");
  });

  it("logs status 500, clamps negative duration, and rethrows", async () => {
    const entries: HttpRequestLog[] = [];
    const failure = new Error("handler failed");
    const wrapped = withRequestLogging(
      async () => {
        throw failure;
      },
      {
        clock: vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(10),
        idFactory: () => "request-failure",
        sink: (entry) => entries.push(entry),
      },
    );

    await expect(
      wrapped(new Request("https://example.test/api/locations")),
    ).rejects.toBe(failure);
    expect(entries).toEqual([
      {
        event: "http_request",
        requestId: "request-failure",
        method: "GET",
        path: "/api/locations",
        statusCode: 500,
        durationMs: 0,
      },
    ]);
  });
});
