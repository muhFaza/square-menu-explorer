import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ConfigurationError } from "@/lib/errors/application-error";

import { getServerEnvironment, parseServerEnvironment } from "./env";

describe("parseServerEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trims values, parses the port, and freezes the result", () => {
    const config = parseServerEnvironment({
      SQUARE_ACCESS_TOKEN: "  fake-sandbox-token  ",
      SQUARE_ENVIRONMENT: "  sandbox  ",
      PORT: "  3100  ",
      SQUARE_APPLICATION_ID: "  fake-application-id  ",
    });

    expect(config).toEqual({
      squareAccessToken: "fake-sandbox-token",
      squareEnvironment: "sandbox",
      port: 3100,
      squareApplicationId: "fake-application-id",
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("accepts production and omits a blank optional application ID", () => {
    expect(
      parseServerEnvironment({
        SQUARE_ACCESS_TOKEN: "fake-production-token",
        SQUARE_ENVIRONMENT: "production",
        PORT: "65535",
        SQUARE_APPLICATION_ID: "   ",
      }),
    ).toEqual({
      squareAccessToken: "fake-production-token",
      squareEnvironment: "production",
      port: 65_535,
    });
  });

  it("trims the optional webhook signature key and notification URL", () => {
    expect(
      parseServerEnvironment({
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "sandbox",
        PORT: "3000",
        SQUARE_WEBHOOK_SIGNATURE_KEY: "  fake-signature-key  ",
        SQUARE_WEBHOOK_NOTIFICATION_URL:
          "  https://example.test/api/webhooks/square  ",
      }),
    ).toMatchObject({
      squareWebhookSignatureKey: "fake-signature-key",
      squareWebhookNotificationUrl: "https://example.test/api/webhooks/square",
    });
  });

  it("omits blank or missing webhook configuration", () => {
    expect(
      parseServerEnvironment({
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "sandbox",
        PORT: "3000",
        SQUARE_WEBHOOK_SIGNATURE_KEY: "   ",
      }),
    ).toEqual({
      squareAccessToken: "fake-token",
      squareEnvironment: "sandbox",
      port: 3000,
    });
  });

  it("reads process.env lazily each time getServerEnvironment is called", () => {
    vi.stubEnv("SQUARE_ACCESS_TOKEN", "fake-first-token");
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("PORT", "3000");

    expect(getServerEnvironment().squareAccessToken).toBe("fake-first-token");

    vi.stubEnv("SQUARE_ACCESS_TOKEN", "fake-second-token");
    expect(getServerEnvironment().squareAccessToken).toBe("fake-second-token");
  });

  it.each([
    ["missing token", { SQUARE_ENVIRONMENT: "sandbox", PORT: "3000" }],
    [
      "unsupported environment",
      {
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "staging",
        PORT: "3000",
      },
    ],
    [
      "fractional port",
      {
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "sandbox",
        PORT: "3.5",
      },
    ],
    [
      "port below range",
      {
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "sandbox",
        PORT: "0",
      },
    ],
    [
      "port above range",
      {
        SQUARE_ACCESS_TOKEN: "fake-token",
        SQUARE_ENVIRONMENT: "sandbox",
        PORT: "65536",
      },
    ],
  ])("rejects %s without exposing supplied values", (_label, source) => {
    let thrown: unknown;

    try {
      parseServerEnvironment(source);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigurationError);
    expect(thrown).toMatchObject({
      code: "CONFIGURATION_ERROR",
      statusCode: 500,
      publicMessage: "Server configuration is invalid.",
    });
    expect((thrown as Error).message).not.toContain("fake-token");
    expect((thrown as Error).message).not.toContain("staging");
    expect((thrown as Error).message).not.toContain("65536");
  });
});
