import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AsyncTtlCache,
  CATALOG_CACHE_TTL_MS,
  createCatalogCacheKey,
} from "./catalog-cache";

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("AsyncTtlCache", () => {
  it("returns a successful value until its TTL expires", async () => {
    let now = 1_000;
    const cache = new AsyncTtlCache<string>({
      ttlMs: 100,
      clock: () => now,
    });
    const loader = vi.fn().mockResolvedValue("first");

    await expect(cache.getOrLoad("key", loader)).resolves.toBe("first");
    now = 1_099;
    await expect(cache.getOrLoad("key", loader)).resolves.toBe("first");
    expect(loader).toHaveBeenCalledOnce();

    now = 1_100;
    loader.mockResolvedValue("refreshed");
    await expect(cache.getOrLoad("key", loader)).resolves.toBe("refreshed");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("starts the TTL when a successful load completes", async () => {
    let now = 0;
    const cache = new AsyncTtlCache<string>({
      ttlMs: 100,
      clock: () => now,
    });
    const pending = deferred<string>();
    const load = cache.getOrLoad("key", () => pending.promise);

    now = 80;
    pending.resolve("value");
    await expect(load).resolves.toBe("value");
    now = 179;
    const loader = vi.fn().mockResolvedValue("unexpected");

    await expect(cache.getOrLoad("key", loader)).resolves.toBe("value");
    expect(loader).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent loads for the same key", async () => {
    const cache = new AsyncTtlCache<string>();
    const pending = deferred<string>();
    const loader = vi.fn(() => pending.promise);

    const first = cache.getOrLoad("same", loader);
    const second = cache.getOrLoad("same", loader);
    await Promise.resolve();

    expect(loader).toHaveBeenCalledOnce();
    pending.resolve("shared");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "shared",
      "shared",
    ]);
  });

  it("does not deduplicate different location keys", async () => {
    const cache = new AsyncTtlCache<string>();
    const loaderA = vi.fn().mockResolvedValue("a");
    const loaderB = vi.fn().mockResolvedValue("b");

    await expect(
      Promise.all([
        cache.getOrLoad("catalog:A", loaderA),
        cache.getOrLoad("catalog:B", loaderB),
      ]),
    ).resolves.toEqual(["a", "b"]);
    expect(loaderA).toHaveBeenCalledOnce();
    expect(loaderB).toHaveBeenCalledOnce();
  });

  it("clears a rejected load so the next request can recover", async () => {
    const cache = new AsyncTtlCache<string>();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("fake-failure"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.getOrLoad("key", loader)).rejects.toThrow(
      "fake-failure",
    );
    await expect(cache.getOrLoad("key", loader)).resolves.toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("clears a synchronous loader failure so the next request can recover", async () => {
    const cache = new AsyncTtlCache<string>();
    const loader = vi
      .fn<() => string>()
      .mockImplementationOnce(() => {
        throw new Error("fake-sync-failure");
      })
      .mockReturnValueOnce("recovered");

    await expect(cache.getOrLoad("key", loader)).rejects.toThrow(
      "fake-sync-failure",
    );
    await expect(cache.getOrLoad("key", loader)).resolves.toBe("recovered");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid TTL %#",
    (ttlMs) => {
      expect(() => new AsyncTtlCache({ ttlMs })).toThrow(
        "ttlMs must be a positive safe integer.",
      );
    },
  );
});

describe("createCatalogCacheKey", () => {
  it("creates a deterministic location-distinguishing key", () => {
    expect(createCatalogCacheKey("LOCATION1")).toBe("catalog:LOCATION1");
    expect(createCatalogCacheKey("LOCATION2")).toBe("catalog:LOCATION2");
  });

  it("uses the documented five-minute production TTL", () => {
    expect(CATALOG_CACHE_TTL_MS).toBe(300_000);
  });
});
