import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ServerEnvironment } from "@/lib/config/env";
import type { HttpRequestLog } from "@/lib/logging/request-logger";

import {
  createAdminCacheInvalidatePostHandler,
  dynamic as adminDynamic,
  runtime as adminRuntime,
} from "./route";

const ADMIN_API_KEY = "fake-admin-key";
const ENDPOINT_URL = "https://example.test/api/admin/cache/invalidate";

function adminEnvironment(
  overrides: Partial<ServerEnvironment> = {},
): Readonly<ServerEnvironment> {
  return Object.freeze({
    squareAccessToken: "fake-token",
    squareEnvironment: "sandbox",
    port: 3000,
    adminApiKey: ADMIN_API_KEY,
    ...overrides,
  });
}

function createTestHandler({
  environment = adminEnvironment(),
  invalidateCatalog = vi.fn(),
  invalidateLocations = vi.fn(),
}: {
  environment?: Readonly<ServerEnvironment>;
  invalidateCatalog?: () => void;
  invalidateLocations?: () => void;
} = {}) {
  const entries: HttpRequestLog[] = [];
  let requestNumber = 0;
  let time = 0;
  const requestLogging = {
    clock: () => {
      time += 5;
      return time;
    },
    idFactory: () => `admin-request-${(requestNumber += 1)}`,
    sink: (entry: HttpRequestLog) => entries.push(entry),
  };

  return {
    post: createAdminCacheInvalidatePostHandler({
      catalogCache: { invalidateAll: invalidateCatalog },
      locationsCache: { invalidateAll: invalidateLocations },
      getEnvironment: () => environment,
      requestLogging,
    }),
    entries,
    invalidateCatalog,
    invalidateLocations,
  };
}

function adminRequest(authorization: string | null = `Bearer ${ADMIN_API_KEY}`) {
  const headers = new Headers();
  if (authorization !== null) {
    headers.set("authorization", authorization);
  }
  return new Request(ENDPOINT_URL, { method: "POST", headers });
}

describe("admin cache invalidate Route Handler integration", () => {
  it("forces dynamic Node.js execution", () => {
    expect(adminRuntime).toBe("nodejs");
    expect(adminDynamic).toBe("force-dynamic");
  });

  it("returns 404 with a generic envelope when the key is unset", async () => {
    const { post, invalidateCatalog, invalidateLocations } = createTestHandler({
      environment: adminEnvironment({ adminApiKey: undefined }),
    });

    const response = await post(adminRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND", message: "Not found." },
    });
    expect(invalidateCatalog).not.toHaveBeenCalled();
    expect(invalidateLocations).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization is missing", async () => {
    const { post, invalidateCatalog, invalidateLocations } = createTestHandler();

    const response = await post(adminRequest(null));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing admin credentials.",
      },
    });
    expect(invalidateCatalog).not.toHaveBeenCalled();
    expect(invalidateLocations).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed Authorization header", async () => {
    const { post, invalidateCatalog } = createTestHandler();

    const response = await post(adminRequest(ADMIN_API_KEY));

    expect(response.status).toBe(401);
    expect(invalidateCatalog).not.toHaveBeenCalled();
  });

  it("returns 401 for the wrong key", async () => {
    const { post, invalidateCatalog, invalidateLocations } = createTestHandler();

    const response = await post(adminRequest("Bearer wrong-key"));

    expect(response.status).toBe(401);
    expect(invalidateCatalog).not.toHaveBeenCalled();
    expect(invalidateLocations).not.toHaveBeenCalled();
  });

  it("busts both caches for the correct key", async () => {
    const { post, invalidateCatalog, invalidateLocations, entries } =
      createTestHandler();

    const response = await post(adminRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("admin-request-1");
    expect(await response.json()).toEqual({
      invalidated: ["catalog", "locations"],
    });
    expect(invalidateCatalog).toHaveBeenCalledOnce();
    expect(invalidateLocations).toHaveBeenCalledOnce();
    expect(entries[0]?.statusCode).toBe(200);
  });
});
