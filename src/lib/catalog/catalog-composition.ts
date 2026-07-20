import "server-only";

import { sharedCatalogCache } from "@/lib/catalog/catalog-cache";
import {
  createCatalogService,
  type CatalogService,
} from "@/lib/catalog/catalog-service";
import { sharedLocationsCache } from "@/lib/locations/locations-cache";
import { createSquareCatalogGateway } from "@/lib/square/catalog-gateway";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";

/** Shared by both production catalog endpoints within this server process. */
export const sharedCatalogService: CatalogService = createCatalogService({
  locationsGateway: createSquareLocationsGateway(),
  locationsCache: sharedLocationsCache,
  catalogGateway: createSquareCatalogGateway(),
  cache: sharedCatalogCache,
});
