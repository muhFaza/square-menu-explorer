export const apiErrorCodes = [
  "CONFIGURATION_ERROR",
  "BAD_REQUEST",
  "NOT_FOUND",
  "SQUARE_AUTHENTICATION_ERROR",
  "SQUARE_RATE_LIMITED",
  "SQUARE_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}
