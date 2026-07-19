import { sharedCatalogCache } from "@/lib/catalog/catalog-cache";
import {
  getServerEnvironment,
  type ServerEnvironment,
} from "@/lib/config/env";
import { ApplicationError } from "@/lib/errors/application-error";
import { toApiErrorResponse } from "@/lib/http/api-error";
import { createApiJsonResponse } from "@/lib/http/json-response";
import {
  withRequestLogging,
  type RequestHandler,
  type RequestLoggingDependencies,
} from "@/lib/logging/request-logger";
import {
  parseSquareWebhookEvent,
  verifySquareWebhookSignature,
} from "@/lib/webhooks/square-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG_UPDATED_EVENT_TYPE = "catalog.version.updated";
const SIGNATURE_HEADER = "x-square-hmacsha256-signature";

interface CatalogCacheInvalidator {
  invalidateAll(): void;
}

interface SquareWebhookHandlerDependencies {
  readonly cache: CatalogCacheInvalidator;
  readonly getEnvironment?: () => Readonly<ServerEnvironment>;
}

export interface SquareWebhookPostHandlerDependencies
  extends SquareWebhookHandlerDependencies {
  readonly requestLogging?: Partial<RequestLoggingDependencies>;
}

function notConfiguredError(): ApplicationError {
  return new ApplicationError({
    code: "SERVICE_UNAVAILABLE",
    statusCode: 503,
    message: "Square webhook signature key or notification URL is not set.",
    publicMessage: "Webhook processing is not configured.",
  });
}

function invalidSignatureError(): ApplicationError {
  return new ApplicationError({
    code: "UNAUTHORIZED",
    statusCode: 401,
    message: "Square webhook signature verification failed.",
    publicMessage: "Invalid webhook signature.",
  });
}

function malformedBodyError(): ApplicationError {
  return new ApplicationError({
    code: "BAD_REQUEST",
    statusCode: 400,
    message: "Square webhook body was not a JSON object with a type.",
    publicMessage: "Webhook payload is invalid.",
  });
}

export function createSquareWebhookHandler({
  cache,
  getEnvironment = getServerEnvironment,
}: SquareWebhookHandlerDependencies): RequestHandler {
  return async (request, { requestId }) => {
    try {
      const rawBody = await request.text();
      const environment = getEnvironment();
      const signatureKey = environment.squareWebhookSignatureKey;
      const notificationUrl = environment.squareWebhookNotificationUrl;

      if (!signatureKey || !notificationUrl) {
        throw notConfiguredError();
      }

      const isValid = verifySquareWebhookSignature({
        signatureKey,
        notificationUrl,
        rawBody,
        signatureHeader: request.headers.get(SIGNATURE_HEADER),
      });
      if (!isValid) {
        throw invalidSignatureError();
      }

      const event = parseSquareWebhookEvent(rawBody);
      if (!event) {
        throw malformedBodyError();
      }

      if (event.type === CATALOG_UPDATED_EVENT_TYPE) {
        cache.invalidateAll();
        return createApiJsonResponse(
          { received: true, processed: true },
          requestId,
        );
      }

      // Acknowledge unrelated events so Square does not retry them.
      return createApiJsonResponse(
        { received: true, processed: false },
        requestId,
      );
    } catch (error) {
      return toApiErrorResponse(error, requestId);
    }
  };
}

export function createSquareWebhookPostHandler({
  cache,
  getEnvironment,
  requestLogging,
}: SquareWebhookPostHandlerDependencies): (
  request: Request,
) => Promise<Response> {
  return withRequestLogging(
    createSquareWebhookHandler({ cache, getEnvironment }),
    requestLogging,
  );
}

export const POST = createSquareWebhookPostHandler({
  cache: sharedCatalogCache,
});
