import "server-only";

import type { Location } from "square";

import { mapActiveLocations } from "@/lib/locations/location-mapper";
import { LOCATIONS_CACHE_KEY } from "@/lib/locations/locations-cache";
import type { LocationsResponse } from "@/types/locations";

export interface LocationsGateway {
  listLocations(): Promise<readonly Location[]>;
}

export interface LocationsResultCache {
  getOrLoad(
    key: string,
    loader: () => LocationsResponse | Promise<LocationsResponse>,
  ): Promise<LocationsResponse>;
}

/** Coordinates the use case while keeping Square transport details out of HTTP. */
export async function listActiveLocations(
  gateway: LocationsGateway,
  cache: LocationsResultCache,
): Promise<LocationsResponse> {
  return cache.getOrLoad(LOCATIONS_CACHE_KEY, async () => {
    const squareLocations = await gateway.listLocations();

    return {
      locations: mapActiveLocations(squareLocations),
    };
  });
}
