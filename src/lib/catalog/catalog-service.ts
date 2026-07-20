import "server-only";

import { mapCatalogForLocation } from "@/lib/catalog/catalog-mapper";
import { createCatalogCacheKey } from "@/lib/catalog/catalog-cache";
import { ApplicationError } from "@/lib/errors/application-error";
import {
  listActiveLocations,
  type LocationsGateway,
  type LocationsResultCache,
} from "@/lib/locations/location-service";
import type { SquareCatalogGateway } from "@/lib/square/catalog-gateway";
import type {
  CatalogCategoriesResponse,
  CatalogResponse,
} from "@/types/catalog";

export interface CatalogResultCache {
  getOrLoad(
    key: string,
    loader: () => CatalogResponse | Promise<CatalogResponse>,
  ): Promise<CatalogResponse>;
}

export interface CatalogService {
  getCatalog(locationId: string): Promise<CatalogResponse>;
  getCategories(locationId: string): Promise<CatalogCategoriesResponse>;
}

export interface CatalogServiceDependencies {
  readonly locationsGateway: LocationsGateway;
  readonly locationsCache: LocationsResultCache;
  readonly catalogGateway: SquareCatalogGateway;
  readonly cache: CatalogResultCache;
}

function createLocationNotFoundError(locationId: string): ApplicationError {
  return new ApplicationError({
    code: "NOT_FOUND",
    statusCode: 404,
    message: `Active Square location ${locationId} was not found.`,
    publicMessage: "The requested location was not found.",
  });
}

export function projectCatalogCategories(
  catalog: CatalogResponse,
): CatalogCategoriesResponse {
  return {
    categories: catalog.categories
      .filter(({ items }) => items.length > 0)
      .map(({ id, name, items }) => ({
        id,
        name,
        item_count: items.length,
      })),
  };
}

/** Coordinates active-location validation, complete retrieval, mapping, and cache. */
export function createCatalogService({
  locationsGateway,
  locationsCache,
  catalogGateway,
  cache,
}: CatalogServiceDependencies): CatalogService {
  const getCatalog = (locationId: string): Promise<CatalogResponse> =>
    cache.getOrLoad(createCatalogCacheKey(locationId), async () => {
      const { locations } = await listActiveLocations(
        locationsGateway,
        locationsCache,
      );
      if (!locations.some(({ id }) => id === locationId)) {
        throw createLocationNotFoundError(locationId);
      }

      const rawCatalog = await catalogGateway.fetchCatalog();
      return mapCatalogForLocation(rawCatalog, locationId);
    });

  return {
    getCatalog,
    async getCategories(locationId) {
      return projectCatalogCategories(await getCatalog(locationId));
    },
  };
}
