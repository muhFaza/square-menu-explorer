import { ApplicationError } from "@/lib/errors/application-error";
import type { ApiErrorResponse } from "@/types/api";

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred.";

interface PublicErrorDetails {
  statusCode: number;
  body: ApiErrorResponse;
}

export function toPublicErrorDetails(
  error: unknown,
  requestId?: string,
): PublicErrorDetails {
  if (error instanceof ApplicationError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.publicMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: UNEXPECTED_ERROR_MESSAGE,
        ...(requestId ? { requestId } : {}),
      },
    },
  };
}

export function toApiErrorResponse(
  error: unknown,
  requestId?: string,
): Response {
  const { statusCode, body } = toPublicErrorDetails(error, requestId);
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });

  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers,
  });
}
