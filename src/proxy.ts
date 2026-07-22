import type { NextRequest } from "next/server";

import { ApplicationError } from "@/lib/errors/application-error";
import { toApiErrorResponse } from "@/lib/http/api-error";
import { isFetchSiteAllowed } from "@/lib/http/fetch-site-policy";
import {
  adminRateLimiter,
  getClientKey,
  publicRateLimiter,
} from "@/lib/http/rate-limit";

export const config = { matcher: "/api/:path*" };

function forbiddenResponse(): Response {
  return toApiErrorResponse(
    new ApplicationError({
      code: "FORBIDDEN",
      statusCode: 403,
      message: "Cross-site request rejected by Sec-Fetch-Site policy.",
      publicMessage: "Forbidden.",
    }),
  );
}

function rateLimitedResponse(retryAfterSeconds: number): Response {
  const response = toApiErrorResponse(
    new ApplicationError({
      code: "RATE_LIMITED",
      statusCode: 429,
      message: "Per-IP request rate limit exceeded.",
      publicMessage: "Too many requests. Please retry shortly.",
    }),
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

/**
 * Request-policy gate for /api/*: Sec-Fetch-Site check first, then per-IP rate
 * limiting. Returning undefined lets the request continue to the route handler.
 */
export default function proxy(request: NextRequest): Response | undefined {
  if (!isFetchSiteAllowed(request.headers.get("sec-fetch-site"))) {
    return forbiddenResponse();
  }

  const limiter = request.nextUrl.pathname.startsWith("/api/admin")
    ? adminRateLimiter
    : publicRateLimiter;
  const decision = limiter.check(
    getClientKey(request.headers.get("x-forwarded-for")),
  );
  if (!decision.allowed) {
    return rateLimitedResponse(decision.retryAfterSeconds);
  }

  return undefined;
}
