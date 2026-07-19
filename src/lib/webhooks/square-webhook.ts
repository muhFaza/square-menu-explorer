import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export interface SquareWebhookSignatureInput {
  readonly signatureKey: string;
  readonly notificationUrl: string;
  readonly rawBody: string;
  readonly signatureHeader: string | null;
}

/**
 * Square signs each delivery as base64(HMAC-SHA256(key, notificationUrl + rawBody)).
 * The notification URL must match the subscription exactly; a constant-time
 * comparison avoids leaking the signature through timing. Never throws on
 * malformed input so callers can treat any failure as an unauthenticated request.
 */
export function verifySquareWebhookSignature({
  signatureKey,
  notificationUrl,
  rawBody,
  signatureHeader,
}: SquareWebhookSignatureInput): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + rawBody)
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

/** Extracts only the event type we act on; returns null for anything unusable. */
export function parseSquareWebhookEvent(
  rawBody: string,
): { readonly type: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "type" in parsed &&
    typeof (parsed as { type: unknown }).type === "string"
  ) {
    return { type: (parsed as { type: string }).type };
  }

  return null;
}
