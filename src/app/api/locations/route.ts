import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import {
  listActiveLocations,
  type LocationsGateway,
} from "@/lib/locations/location-service";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LocationsHandlerDependencies {
  readonly gateway: LocationsGateway;
}

export interface LocationsGetHandlerDependencies
  extends LocationsHandlerDependencies {
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

/** HTTP composition only: service invocation, public envelope, and error boundary. */
export function createLocationsHandler({
  gateway,
}: LocationsHandlerDependencies): RequestHandler {
  return async (_request, { requestId }) => {
    try {
      const response = await listActiveLocations(gateway);
      return createApiJsonResponse(response, requestId);
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };
}

export function createLocationsGetHandler({
  gateway,
  requestLogging,
}: LocationsGetHandlerDependencies): (request: Request) => Promise<Response> {
  return withRequestLogging(
    createLocationsHandler({ gateway }),
    requestLogging,
  );
}

export const GET = createLocationsGetHandler({
  gateway: createSquareLocationsGateway(),
});
