import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CATALOG_CACHE_TTL_MS, createCatalogCacheKey } from "./catalog-cache";

describe("createCatalogCacheKey", () => {
  it("creates a deterministic location-distinguishing key", () => {
    expect(createCatalogCacheKey("LOCATION1")).toBe("catalog:LOCATION1");
    expect(createCatalogCacheKey("LOCATION2")).toBe("catalog:LOCATION2");
  });

  it("uses the documented five-minute production TTL", () => {
    expect(CATALOG_CACHE_TTL_MS).toBe(300_000);
  });
});
