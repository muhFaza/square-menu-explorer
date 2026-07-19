export function createApiJsonResponse(
  body: unknown,
  requestId: string,
  statusCode = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
