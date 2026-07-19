import { beforeEach, describe, expect, it, vi } from "vitest";

const squareMocks = vi.hoisted(() => ({
  clientConstructor: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("square", () => ({
  SquareEnvironment: {
    Sandbox: "https://sandbox.example.test",
    Production: "https://production.example.test",
  },
  SquareClient: class SquareClient {
    constructor(options: unknown) {
      squareMocks.clientConstructor(options);
    }
  },
}));

import {
  createSquareClient,
  mapSquareEnvironment,
} from "@/lib/square/client";

describe("Square client factory", () => {
  beforeEach(() => {
    squareMocks.clientConstructor.mockClear();
  });

  it("maps both supported environment names to the SDK constants", () => {
    expect(mapSquareEnvironment("sandbox")).toBe(
      "https://sandbox.example.test",
    );
    expect(mapSquareEnvironment("production")).toBe(
      "https://production.example.test",
    );
  });

  it("constructs the SDK client with the validated token and environment", () => {
    createSquareClient({
      squareAccessToken: "fake-token",
      squareEnvironment: "sandbox",
      port: 3000,
    });

    expect(squareMocks.clientConstructor).toHaveBeenCalledExactlyOnceWith({
      token: "fake-token",
      environment: "https://sandbox.example.test",
    });
  });
});
