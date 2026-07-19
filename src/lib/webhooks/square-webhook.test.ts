import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseSquareWebhookEvent,
  verifySquareWebhookSignature,
} from "./square-webhook";

const SIGNATURE_KEY = "fake-signature-key";
const NOTIFICATION_URL = "https://example.test/api/webhooks/square";
const RAW_BODY = JSON.stringify({ type: "catalog.version.updated" });

function sign(
  key: string,
  url: string,
  body: string,
): string {
  return createHmac("sha256", key)
    .update(url + body)
    .digest("base64");
}

describe("verifySquareWebhookSignature", () => {
  it("accepts a signature produced with the matching key, URL, and body", () => {
    expect(
      verifySquareWebhookSignature({
        signatureKey: SIGNATURE_KEY,
        notificationUrl: NOTIFICATION_URL,
        rawBody: RAW_BODY,
        signatureHeader: sign(SIGNATURE_KEY, NOTIFICATION_URL, RAW_BODY),
      }),
    ).toBe(true);
  });

  it("rejects a signature computed with a different key", () => {
    expect(
      verifySquareWebhookSignature({
        signatureKey: SIGNATURE_KEY,
        notificationUrl: NOTIFICATION_URL,
        rawBody: RAW_BODY,
        signatureHeader: sign("other-key", NOTIFICATION_URL, RAW_BODY),
      }),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySquareWebhookSignature({
        signatureKey: SIGNATURE_KEY,
        notificationUrl: NOTIFICATION_URL,
        rawBody: JSON.stringify({ type: "catalog.version.updated", evil: 1 }),
        signatureHeader: sign(SIGNATURE_KEY, NOTIFICATION_URL, RAW_BODY),
      }),
    ).toBe(false);
  });

  it("rejects a signature bound to a different notification URL", () => {
    expect(
      verifySquareWebhookSignature({
        signatureKey: SIGNATURE_KEY,
        notificationUrl: NOTIFICATION_URL,
        rawBody: RAW_BODY,
        signatureHeader: sign(
          SIGNATURE_KEY,
          "https://evil.test/api/webhooks/square",
          RAW_BODY,
        ),
      }),
    ).toBe(false);
  });

  it.each([null, "", "not-base64-$$$", "c2hvcnQ="])(
    "returns false without throwing for missing or malformed header %#",
    (signatureHeader) => {
      expect(() =>
        verifySquareWebhookSignature({
          signatureKey: SIGNATURE_KEY,
          notificationUrl: NOTIFICATION_URL,
          rawBody: RAW_BODY,
          signatureHeader,
        }),
      ).not.toThrow();
      expect(
        verifySquareWebhookSignature({
          signatureKey: SIGNATURE_KEY,
          notificationUrl: NOTIFICATION_URL,
          rawBody: RAW_BODY,
          signatureHeader,
        }),
      ).toBe(false);
    },
  );
});

describe("parseSquareWebhookEvent", () => {
  it("returns the type for a valid event object", () => {
    expect(
      parseSquareWebhookEvent(JSON.stringify({ type: "catalog.version.updated" })),
    ).toEqual({ type: "catalog.version.updated" });
  });

  it("returns null for non-JSON input", () => {
    expect(parseSquareWebhookEvent("not-json{")).toBeNull();
  });

  it("returns null for JSON without a string type", () => {
    expect(parseSquareWebhookEvent(JSON.stringify({ event_id: "1" }))).toBeNull();
    expect(parseSquareWebhookEvent(JSON.stringify({ type: 42 }))).toBeNull();
    expect(parseSquareWebhookEvent(JSON.stringify(["type"]))).toBeNull();
  });
});
