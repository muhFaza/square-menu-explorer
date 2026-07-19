import "server-only";

import type { ListLocationsResponse } from "square";

import type { LocationsGateway } from "@/lib/locations/location-service";
import { getSquareClient } from "@/lib/square/client";
import {
  mapSquareResponseErrors,
  mapSquareUpstreamError,
} from "@/lib/square/square-error";

export interface SquareLocationsClient {
  readonly locations: {
    list(): Promise<ListLocationsResponse>;
  };
}

export type SquareLocationsClientFactory = () => SquareLocationsClient;

/** Isolates the installed Square SDK call and its response/error shapes. */
export function createSquareLocationsGateway(
  clientFactory: SquareLocationsClientFactory = getSquareClient,
): LocationsGateway {
  return {
    async listLocations() {
      let response: ListLocationsResponse;

      try {
        response = await clientFactory().locations.list();
      } catch (error) {
        throw mapSquareUpstreamError(error);
      }

      if (response.errors && response.errors.length > 0) {
        throw mapSquareResponseErrors(response.errors);
      }

      return response.locations ?? [];
    },
  };
}
