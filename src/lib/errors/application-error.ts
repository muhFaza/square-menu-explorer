import type { ApiErrorCode } from "@/types/api";

interface ApplicationErrorOptions {
  code: ApiErrorCode;
  statusCode: number;
  message: string;
  publicMessage: string;
  cause?: unknown;
}

/**
 * Carries separate diagnostic and public messages across application layers.
 * Only `publicMessage` is safe to return through an HTTP boundary.
 */
export class ApplicationError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor({
    code,
    statusCode,
    message,
    publicMessage,
    cause,
  }: ApplicationErrorOptions) {
    super(message, { cause });
    this.name = "ApplicationError";
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string, options?: { cause?: unknown }) {
    super({
      code: "CONFIGURATION_ERROR",
      statusCode: 500,
      message,
      publicMessage: "Server configuration is invalid.",
      cause: options?.cause,
    });
    this.name = "ConfigurationError";
  }
}

export function createCatalogContractError(message: string): ApplicationError {
  return new ApplicationError({
    code: "SQUARE_UNAVAILABLE",
    statusCode: 502,
    message,
    publicMessage: "Menu data is temporarily unavailable.",
  });
}
