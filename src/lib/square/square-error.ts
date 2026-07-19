import "server-only";

import { SquareError } from "square";
import type { Error_ } from "square";

import { ApplicationError } from "@/lib/errors/application-error";

export type SquareResource = "catalog" | "locations";

const ERROR_CONTEXT = {
  catalog: {
    operation: "SearchCatalogObjects",
    publicMessage: "Menu data is temporarily unavailable.",
    rateLimitPublicMessage:
      "Menu data is temporarily unavailable. Please try again shortly.",
  },
  locations: {
    operation: "ListLocations",
    publicMessage: "Location data is temporarily unavailable.",
    rateLimitPublicMessage:
      "Location data is temporarily unavailable. Please try again shortly.",
  },
} as const satisfies Record<
  SquareResource,
  {
    operation: string;
    publicMessage: string;
    rateLimitPublicMessage: string;
  }
>;

const AUTHENTICATION_ERROR_CODES = new Set([
  "ACCESS_TOKEN_EXPIRED",
  "ACCESS_TOKEN_REVOKED",
  "FORBIDDEN",
  "INSUFFICIENT_SCOPES",
  "UNAUTHORIZED",
]);

function createAuthenticationError(
  resource: SquareResource,
  cause?: unknown,
): ApplicationError {
  const context = ERROR_CONTEXT[resource];

  return new ApplicationError({
    code: "SQUARE_AUTHENTICATION_ERROR",
    statusCode: 502,
    message: `Square rejected credentials during ${context.operation}.`,
    publicMessage: context.publicMessage,
    cause,
  });
}

function createRateLimitError(
  resource: SquareResource,
  cause?: unknown,
): ApplicationError {
  const context = ERROR_CONTEXT[resource];

  return new ApplicationError({
    code: "SQUARE_RATE_LIMITED",
    statusCode: 503,
    message: `Square rate limited ${context.operation}.`,
    publicMessage: context.rateLimitPublicMessage,
    cause,
  });
}

function createUnavailableError(
  resource: SquareResource,
  cause?: unknown,
): ApplicationError {
  const context = ERROR_CONTEXT[resource];

  return new ApplicationError({
    code: "SQUARE_UNAVAILABLE",
    statusCode: 503,
    message: `Square ${context.operation} failed.`,
    publicMessage: context.publicMessage,
    cause,
  });
}

function mapStatusAndCodes(
  statusCode: number | undefined,
  errorCodes: readonly string[],
  resource: SquareResource,
  cause?: unknown,
): ApplicationError {
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    errorCodes.some((code) => AUTHENTICATION_ERROR_CODES.has(code))
  ) {
    return createAuthenticationError(resource, cause);
  }

  if (statusCode === 429 || errorCodes.includes("RATE_LIMITED")) {
    return createRateLimitError(resource, cause);
  }

  return createUnavailableError(resource, cause);
}

/** Converts thrown SDK/network failures without copying raw messages or bodies. */
export function mapSquareUpstreamError(
  error: unknown,
  resource: SquareResource = "locations",
): ApplicationError {
  if (error instanceof SquareError) {
    return mapStatusAndCodes(
      error.statusCode,
      error.errors.map(({ code }) => code),
      resource,
      error,
    );
  }

  return createUnavailableError(resource, error);
}

/** Handles typed Square response errors without exposing upstream details. */
export function mapSquareResponseErrors(
  errors: readonly Pick<Error_, "code">[],
  resource: SquareResource = "locations",
): ApplicationError {
  return mapStatusAndCodes(
    undefined,
    errors.map(({ code }) => code),
    resource,
  );
}
