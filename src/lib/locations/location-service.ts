import "server-only";

import type { Location } from "square";

import { mapActiveLocations } from "@/lib/locations/location-mapper";
import type { LocationsResponse } from "@/types/locations";

export interface LocationsGateway {
  listLocations(): Promise<readonly Location[]>;
}

/** Coordinates the use case while keeping Square transport details out of HTTP. */
export async function listActiveLocations(
  gateway: LocationsGateway,
): Promise<LocationsResponse> {
  const squareLocations = await gateway.listLocations();

  return {
    locations: mapActiveLocations(squareLocations),
  };
}
