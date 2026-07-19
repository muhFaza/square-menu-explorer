import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ServerEnvironment } from "@/lib/config/env";
import type { HttpRequestLog } from "@/lib/logging/request-logger";

import {
  createSquareWebhookPostHandler,
  dynamic as webhookDynamic,
  runtime as webhookRuntime,
} from "./route";

const SIGNATURE_KEY = "fake-signature-key";
const NOTIFICATION_URL = "https://example.test/api/webhooks/square";
const SIGNATURE_HEADER = "x-square-hmacsha256-signature";

function webhookEnvironment(
  overrides: Partial<ServerEnvironment> = {},
): Readonly<ServerEnvironment> {
  return Object.freeze({
    squareAccessToken: "fake-token",
    squareEnvironment: "sandbox",
    port: 3000,
    squareWebhookSignatureKey: SIGNATURE_KEY,
    squareWebhookNotificationUrl: NOTIFICATION_URL,
    ...overrides,
  });
}

function sign(body: string): string {
  return createHmac("sha256", SIGNATURE_KEY)
    .update(NOTIFICATION_URL + body)
    .digest("base64");
}

function createTestHandler({
  environment = webhookEnvironment(),
  invalidateAll = vi.fn(),
}: {
  environment?: Readonly<ServerEnvironment>;
  invalidateAll?: () => void;
} = {}) {
  const entries: HttpRequestLog[] = [];
  let requestNumber = 0;
  let time = 0;
  const requestLogging = {
    clock: () => {
      time += 5;
      return time;
    },
    idFactory: () => `webhook-request-${(requestNumber += 1)}`,
    sink: (entry: HttpRequestLog) => entries.push(entry),
  };

  return {
    post: createSquareWebhookPostHandler({
      cache: { invalidateAll },
      getEnvironment: () => environment,
      requestLogging,
    }),
    entries,
    invalidateAll,
  };
}

function webhookRequest(
  body: string,
  signatureHeader: string | null = sign(body),
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signatureHeader !== null) {
    headers.set(SIGNATURE_HEADER, signatureHeader);
  }
  return new Request(NOTIFICATION_URL, { method: "POST", headers, body });
}

describe("square webhook Route Handler integration", () => {
  it("forces dynamic Node.js execution", () => {
    expect(webhookRuntime).toBe("nodejs");
    expect(webhookDynamic).toBe("force-dynamic");
  });

  it("busts the catalog cache for catalog.version.updated", async () => {
    const { post, invalidateAll, entries } = createTestHandler();
    const body = JSON.stringify({ type: "catalog.version.updated" });

    const response = await post(webhookRequest(body));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("webhook-request-1");
    expect(await response.json()).toEqual({
      received: true,
      processed: true,
    });
    expect(invalidateAll).toHaveBeenCalledOnce();
    expect(entries[0]?.statusCode).toBe(200);
  });

  it("acknowledges unrelated events without busting the cache", async () => {
    const { post, invalidateAll } = createTestHandler();
    const body = JSON.stringify({ type: "inventory.count.updated" });

    const response = await post(webhookRequest(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      processed: false,
    });
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature with 401 and does not bust the cache", async () => {
    const { post, invalidateAll } = createTestHandler();
    const body = JSON.stringify({ type: "catalog.version.updated" });

    const response = await post(webhookRequest(body, "d3Jvbmc="));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Invalid webhook signature." },
    });
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("responds 503 when webhook configuration is missing", async () => {
    const { post, invalidateAll } = createTestHandler({
      environment: webhookEnvironment({
        squareWebhookSignatureKey: undefined,
        squareWebhookNotificationUrl: undefined,
      }),
    });
    const body = JSON.stringify({ type: "catalog.version.updated" });

    const response = await post(webhookRequest(body, null));
    const serialized = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(serialized)).toMatchObject({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Webhook processing is not configured.",
      },
    });
    expect(serialized).not.toContain(SIGNATURE_KEY);
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("rejects a validly signed body that is not a JSON event with 400", async () => {
    const { post, invalidateAll } = createTestHandler();

    const response = await post(webhookRequest("not-json{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
    expect(invalidateAll).not.toHaveBeenCalled();
  });
});
