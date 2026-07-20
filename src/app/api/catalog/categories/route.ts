import { sharedCatalogService } from "@/lib/catalog/catalog-composition";
import type { CatalogService } from "@/lib/catalog/catalog-service";
import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import { parseLocationId } from "@/lib/http/location-id";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CatalogCategoriesGetHandlerDependencies {
  readonly service: CatalogService;
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

export function createCatalogCategoriesGetHandler({
  service,
  requestLogging,
}: CatalogCategoriesGetHandlerDependencies): (
  request: Request,
) => Promise<Response> {
  const handler: RequestHandler = async (request, { requestId }) => {
    try {
      const locationId = parseLocationId(request);
      return createApiJsonResponse(
        await service.getCategories(locationId),
        requestId,
      );
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };

  return withRequestLogging(handler, requestLogging);
}

export const GET = createCatalogCategoriesGetHandler({
  service: sharedCatalogService,
});
