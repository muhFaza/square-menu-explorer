import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import {
  listActiveLocations,
  type LocationsGateway,
  type LocationsResultCache,
} from "@/lib/locations/location-service";
import { sharedLocationsCache } from "@/lib/locations/locations-cache";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LocationsGetHandlerDependencies {
  readonly gateway: LocationsGateway;
  readonly cache: LocationsResultCache;
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

/** HTTP composition only: service invocation, public envelope, and error boundary. */
export function createLocationsGetHandler({
  gateway,
  cache,
  requestLogging,
}: LocationsGetHandlerDependencies): (request: Request) => Promise<Response> {
  const handler: RequestHandler = async (_request, { requestId }) => {
    try {
      const response = await listActiveLocations(gateway, cache);
      return createApiJsonResponse(response, requestId);
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };

  return withRequestLogging(handler, requestLogging);
}

export const GET = createLocationsGetHandler({
  gateway: createSquareLocationsGateway(),
  cache: sharedLocationsCache,
});
