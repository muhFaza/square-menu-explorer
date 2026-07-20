import "server-only";

import { AsyncTtlCache } from "@/lib/cache/async-ttl-cache";
import type { CatalogResponse } from "@/types/catalog";

export const CATALOG_CACHE_TTL_MS = 5 * 60 * 1_000;

export function createCatalogCacheKey(locationId: string): string {
  return `catalog:${locationId}`;
}

/** Shared by both production catalog endpoints within this server process. */
export const sharedCatalogCache = new AsyncTtlCache<CatalogResponse>({
  ttlMs: CATALOG_CACHE_TTL_MS,
});
