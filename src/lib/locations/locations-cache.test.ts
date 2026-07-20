import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LOCATIONS_CACHE_KEY, LOCATIONS_CACHE_TTL_MS } from "./locations-cache";

describe("locations cache constants", () => {
  it("uses a single global key for the active-location list", () => {
    expect(LOCATIONS_CACHE_KEY).toBe("locations:active");
  });

  it("uses the documented five-minute production TTL", () => {
    expect(LOCATIONS_CACHE_TTL_MS).toBe(300_000);
  });
});
