import {
  createCatalogService,
  type CatalogService,
} from "@/lib/catalog/catalog-service";
import { sharedCatalogCache } from "@/lib/catalog/catalog-cache";
import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import { parseLocationId } from "@/lib/http/location-id";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";
import { createSquareCatalogGateway } from "@/lib/square/catalog-gateway";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CatalogHandlerDependencies {
  readonly service: CatalogService;
}

export interface CatalogGetHandlerDependencies
  extends CatalogHandlerDependencies {
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

export function createCatalogHandler({
  service,
}: CatalogHandlerDependencies): RequestHandler {
  return async (request, { requestId }) => {
    try {
      const locationId = parseLocationId(request);
      return createApiJsonResponse(
        await service.getCatalog(locationId),
        requestId,
      );
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };
}

export function createCatalogGetHandler({
  service,
  requestLogging,
}: CatalogGetHandlerDependencies): (request: Request) => Promise<Response> {
  return withRequestLogging(createCatalogHandler({ service }), requestLogging);
}

const catalogService = createCatalogService({
  locationsGateway: createSquareLocationsGateway(),
  catalogGateway: createSquareCatalogGateway(),
  cache: sharedCatalogCache,
});

export const GET = createCatalogGetHandler({ service: catalogService });
