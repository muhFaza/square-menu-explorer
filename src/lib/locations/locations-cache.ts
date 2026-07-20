import "server-only";

import { AsyncTtlCache } from "@/lib/cache/async-ttl-cache";
import type { LocationsResponse } from "@/types/locations";

export const LOCATIONS_CACHE_TTL_MS = 5 * 60 * 1_000;

/** Active locations are not partitioned per request, so one global key suffices. */
export const LOCATIONS_CACHE_KEY = "locations:active";

/** Shared by the locations endpoint and the catalog cache-miss location check. */
export const sharedLocationsCache = new AsyncTtlCache<LocationsResponse>({
  ttlMs: LOCATIONS_CACHE_TTL_MS,
});
