import { createHash, timingSafeEqual } from "node:crypto";

import { sharedCatalogCache } from "@/lib/catalog/catalog-cache";
import {
  getServerEnvironment,
  type ServerEnvironment,
} from "@/lib/config/env";
import { ApplicationError } from "@/lib/errors/application-error";
import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import { sharedLocationsCache } from "@/lib/locations/locations-cache";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEARER_PREFIX = "Bearer ";

interface CacheInvalidator {
  invalidateAll(): void;
}

interface AdminCacheInvalidateHandlerDependencies {
  readonly catalogCache: CacheInvalidator;
  readonly locationsCache: CacheInvalidator;
  readonly getEnvironment?: () => Readonly<ServerEnvironment>;
}

export interface AdminCacheInvalidatePostHandlerDependencies
  extends AdminCacheInvalidateHandlerDependencies {
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

function notFoundError(): ApplicationError {
  return new ApplicationError({
    code: "NOT_FOUND",
    statusCode: 404,
    message: "Admin cache invalidation is disabled because ADMIN_API_KEY is unset.",
    publicMessage: "Not found.",
  });
}

function unauthorizedError(): ApplicationError {
  return new ApplicationError({
    code: "UNAUTHORIZED",
    statusCode: 401,
    message: "Admin cache invalidation credentials were missing or invalid.",
    publicMessage: "Invalid or missing admin credentials.",
  });
}

function extractBearerToken(header: string | null): string | undefined {
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  return header.slice(BEARER_PREFIX.length).trim() || undefined;
}

/** SHA-256 both sides so timingSafeEqual gets equal-length buffers, avoiding its length exception and any length leak. */
function credentialsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export function createAdminCacheInvalidateHandler({
  catalogCache,
  locationsCache,
  getEnvironment = getServerEnvironment,
}: AdminCacheInvalidateHandlerDependencies): RequestHandler {
  return async (request, { requestId }) => {
    try {
      const adminApiKey = getEnvironment().adminApiKey;
      if (!adminApiKey) {
        throw notFoundError();
      }

      const token = extractBearerToken(request.headers.get("authorization"));
      if (!token || !credentialsMatch(token, adminApiKey)) {
        throw unauthorizedError();
      }

      catalogCache.invalidateAll();
      locationsCache.invalidateAll();
      return createApiJsonResponse(
        { invalidated: ["catalog", "locations"] },
        requestId,
      );
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };
}

export function createAdminCacheInvalidatePostHandler({
  catalogCache,
  locationsCache,
  getEnvironment,
  requestLogging,
}: AdminCacheInvalidatePostHandlerDependencies): (
  request: Request,
) => Promise<Response> {
  return withRequestLogging(
    createAdminCacheInvalidateHandler({
      catalogCache,
      locationsCache,
      getEnvironment,
    }),
    requestLogging,
  );
}

export const POST = createAdminCacheInvalidatePostHandler({
  catalogCache: sharedCatalogCache,
  locationsCache: sharedLocationsCache,
});
