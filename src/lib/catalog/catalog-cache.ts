import "server-only";

import type { CatalogResponse } from "@/types/catalog";

export const CATALOG_CACHE_TTL_MS = 5 * 60 * 1_000;

interface CacheEntry<Value> {
  readonly value: Value;
  readonly expiresAt: number;
}

export interface AsyncTtlCacheOptions {
  readonly ttlMs?: number;
  readonly clock?: () => number;
}

export class AsyncTtlCache<Value> {
  readonly #ttlMs: number;
  readonly #clock: () => number;
  readonly #entries = new Map<string, CacheEntry<Value>>();
  readonly #inFlight = new Map<string, Promise<Value>>();

  constructor({
    ttlMs = CATALOG_CACHE_TTL_MS,
    clock = Date.now,
  }: AsyncTtlCacheOptions = {}) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw new RangeError("ttlMs must be a positive safe integer.");
    }

    this.#ttlMs = ttlMs;
    this.#clock = clock;
  }

  async getOrLoad(
    key: string,
    loader: () => Value | Promise<Value>,
  ): Promise<Value> {
    const cached = this.#entries.get(key);
    if (cached && this.#clock() < cached.expiresAt) {
      return cached.value;
    }

    if (cached) {
      this.#entries.delete(key);
    }

    const existingLoad = this.#inFlight.get(key);
    if (existingLoad) {
      return existingLoad;
    }

    const load = Promise.resolve().then(loader);
    this.#inFlight.set(key, load);

    try {
      const value = await load;
      this.#entries.set(key, {
        value,
        expiresAt: this.#clock() + this.#ttlMs,
      });
      return value;
    } finally {
      if (this.#inFlight.get(key) === load) {
        this.#inFlight.delete(key);
      }
    }
  }
}

export function createCatalogCacheKey(locationId: string): string {
  return `catalog:${locationId}`;
}

/** Shared by both production catalog endpoints within this server process. */
export const sharedCatalogCache = new AsyncTtlCache<CatalogResponse>();
