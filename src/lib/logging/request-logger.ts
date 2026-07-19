import "server-only";

import { randomUUID } from "node:crypto";

export interface RequestContext {
  readonly requestId: string;
}

export interface HttpRequestLog {
  readonly event: "http_request";
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
}

export type RequestHandler = (
  request: Request,
  context: RequestContext,
) => Response | Promise<Response>;

export interface RequestLoggingDependencies {
  readonly clock: () => number;
  readonly idFactory: () => string;
  readonly sink: (entry: HttpRequestLog) => void;
}

const defaultDependencies: RequestLoggingDependencies = {
  clock: () => performance.now(),
  idFactory: randomUUID,
  sink: (entry) => console.info(JSON.stringify(entry)),
};

/**
 * Adds one sanitized completion log around a Route Handler-compatible function.
 * Errors are logged as status 500 and rethrown for the HTTP error boundary.
 */
export function withRequestLogging(
  handler: RequestHandler,
  dependencies: Partial<RequestLoggingDependencies> = {},
): (request: Request) => Promise<Response> {
  const clock = dependencies.clock ?? defaultDependencies.clock;
  const idFactory = dependencies.idFactory ?? defaultDependencies.idFactory;
  const sink = dependencies.sink ?? defaultDependencies.sink;

  return async (request) => {
    const startedAt = clock();
    const requestId = idFactory();
    const baseEntry = {
      event: "http_request" as const,
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
    };

    let response: Response;

    try {
      response = await handler(request, { requestId });
    } catch (error) {
      sink({
        ...baseEntry,
        statusCode: 500,
        durationMs: Math.max(0, clock() - startedAt),
      });
      throw error;
    }

    sink({
      ...baseEntry,
      statusCode: response.status,
      durationMs: Math.max(0, clock() - startedAt),
    });
    return response;
  };
}
