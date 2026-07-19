import { SquareError } from "square";
import type {
  CatalogObject,
  ListLocationsResponse,
  SearchCatalogObjectsResponse,
} from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AsyncTtlCache } from "@/lib/catalog/catalog-cache";
import { createCatalogService } from "@/lib/catalog/catalog-service";
import type { HttpRequestLog } from "@/lib/logging/request-logger";
import { createSquareCatalogGateway } from "@/lib/square/catalog-gateway";
import type { SquareCatalogClient } from "@/lib/square/catalog-gateway";
import { createSquareLocationsGateway } from "@/lib/square/locations-gateway";
import type { SquareLocationsClient } from "@/lib/square/locations-gateway";
import type { CatalogResponse } from "@/types/catalog";

import {
  createCatalogCategoriesGetHandler,
  dynamic as categoriesDynamic,
  runtime as categoriesRuntime,
} from "./categories/route";
import {
  createCatalogGetHandler,
  dynamic as catalogDynamic,
  runtime as catalogRuntime,
} from "./route";

const LOCATION_ID = "LOCATION1";

function activeLocations(): ListLocationsResponse {
  return {
    locations: [{ id: LOCATION_ID, name: "Main cafe", status: "ACTIVE" }],
  };
}

function catalogResponse(): SearchCatalogObjectsResponse {
  const variation: CatalogObject.ItemVariation = {
    id: "VARIATION1",
    type: "ITEM_VARIATION",
    itemVariationData: {
      name: "Regular",
      priceMoney: { amount: BigInt(650), currency: "USD" },
    },
  };
  const item: CatalogObject.Item = {
    id: "ITEM1",
    type: "ITEM",
    itemData: {
      name: "Latte",
      descriptionPlaintext: "Espresso and milk",
      categories: [{ id: "DRINKS" }],
      imageIds: ["IMAGE1"],
      variations: [variation],
    },
  };
  const image: CatalogObject.Image = {
    id: "IMAGE1",
    type: "IMAGE",
    imageData: { url: "https://example.test/latte.jpg" },
  };

  return { objects: [item], relatedObjects: [image] };
}

/** CATEGORY objects arrive from their own search, not the item related objects. */
function categoryResponse(): SearchCatalogObjectsResponse {
  const category: CatalogObject.Category = {
    id: "DRINKS",
    type: "CATEGORY",
    categoryData: { name: "Drinks" },
  };

  return { objects: [category] };
}

/** Routes a Square catalog search to the item or category page it asks for. */
function dispatchCatalogSearch(): SquareCatalogClient["catalog"]["search"] {
  return vi.fn<SquareCatalogClient["catalog"]["search"]>(async (request) =>
    request.objectTypes?.[0] === "CATEGORY"
      ? categoryResponse()
      : catalogResponse(),
  );
}

function createTestHandlers({
  list = vi.fn().mockResolvedValue(activeLocations()),
  search = dispatchCatalogSearch(),
  cache = new AsyncTtlCache<CatalogResponse>(),
}: {
  list?: SquareLocationsClient["locations"]["list"];
  search?: SquareCatalogClient["catalog"]["search"];
  cache?: AsyncTtlCache<CatalogResponse>;
} = {}) {
  const entries: HttpRequestLog[] = [];
  let requestNumber = 0;
  let time = 0;
  const requestLogging = {
    clock: () => {
      time += 5;
      return time;
    },
    idFactory: () => `catalog-request-${(requestNumber += 1)}`,
    sink: (entry: HttpRequestLog) => entries.push(entry),
  };
  const locationsGateway = createSquareLocationsGateway(() => ({
    locations: { list },
  }));
  const catalogGateway = createSquareCatalogGateway(() => ({
    catalog: { search },
  }));
  const catalogService = createCatalogService({
    locationsGateway,
    catalogGateway,
    cache,
  });
  const categoriesService = createCatalogService({
    locationsGateway,
    catalogGateway,
    cache,
  });

  return {
    catalog: createCatalogGetHandler({
      service: catalogService,
      requestLogging,
    }),
    categories: createCatalogCategoriesGetHandler({
      service: categoriesService,
      requestLogging,
    }),
    entries,
    list,
    search,
  };
}

describe("catalog Route Handler integration", () => {
  it("forces both endpoints onto dynamic Node.js execution", () => {
    expect(catalogRuntime).toBe("nodejs");
    expect(catalogDynamic).toBe("force-dynamic");
    expect(categoriesRuntime).toBe("nodejs");
    expect(categoriesDynamic).toBe("force-dynamic");
  });

  it("runs both routes through real gateways/service/cache/mapper with one Square load", async () => {
    const { catalog, categories, entries, list, search } = createTestHandlers();

    const catalogHttpResponse = await catalog(
      new Request(
        `https://example.test/api/catalog?location_id=${LOCATION_ID}`,
      ),
    );
    expect(catalogHttpResponse.status).toBe(200);
    expect(catalogHttpResponse.headers.get("cache-control")).toBe("no-store");
    expect(catalogHttpResponse.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(catalogHttpResponse.headers.get("x-request-id")).toBe(
      "catalog-request-1",
    );
    expect(await catalogHttpResponse.json()).toEqual({
      categories: [
        {
          id: "DRINKS",
          name: "Drinks",
          items: [
            {
              id: "ITEM1",
              name: "Latte",
              description: "Espresso and milk",
              category: "Drinks",
              image_url: "https://example.test/latte.jpg",
              variations: [
                {
                  id: "VARIATION1",
                  name: "Regular",
                  price: { amount: "650", currency: "USD" },
                },
              ],
            },
          ],
        },
      ],
    });

    const categoriesHttpResponse = await categories(
      new Request(
        `https://example.test/api/catalog/categories?location_id=${LOCATION_ID}`,
      ),
    );
    expect(categoriesHttpResponse.status).toBe(200);
    expect(await categoriesHttpResponse.json()).toEqual({
      categories: [{ id: "DRINKS", name: "Drinks", item_count: 1 }],
    });

    expect(list).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenNthCalledWith(1, {
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
    });
    expect(search).toHaveBeenNthCalledWith(2, {
      objectTypes: ["CATEGORY"],
    });
    expect(entries).toEqual([
      {
        event: "http_request",
        requestId: "catalog-request-1",
        method: "GET",
        path: "/api/catalog",
        statusCode: 200,
        durationMs: 5,
      },
      {
        event: "http_request",
        requestId: "catalog-request-2",
        method: "GET",
        path: "/api/catalog/categories",
        statusCode: 200,
        durationMs: 5,
      },
    ]);
  });

  it.each([
    { query: "", message: "location_id is required." },
    { query: "?other=value", message: "location_id is required." },
    { query: "?location_id=", message: "location_id is invalid." },
    { query: "?location_id=%20", message: "location_id is invalid." },
    {
      query: "?location_id=%20LOCATION1",
      message: "location_id is invalid.",
    },
    { query: "?location_id=LOCATION-1", message: "location_id is invalid." },
    {
      query: `?location_id=${"A".repeat(33)}`,
      message: "location_id is invalid.",
    },
    {
      query: "?location_id=LOCATION1&location_id=LOCATION2",
      message: "location_id must be provided exactly once.",
    },
  ])("rejects invalid catalog query $query", async ({ query, message }) => {
    const { catalog, list, search, entries } = createTestHandlers();

    const response = await catalog(
      new Request(`https://example.test/api/catalog${query}`),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message,
        requestId: "catalog-request-1",
      },
    });
    expect(list).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(entries[0]?.statusCode).toBe(400);
  });

  it("applies the same strict query validation to categories", async () => {
    const { categories, list, search } = createTestHandlers();

    const response = await categories(
      new Request(
        "https://example.test/api/catalog/categories?location_id=A&location_id=B",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
    expect(list).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it.each([
    { label: "no active locations", locations: [] },
    {
      label: "an inactive requested location",
      locations: [{ id: LOCATION_ID, name: "Closed", status: "INACTIVE" }],
    },
    {
      label: "an unknown requested location",
      locations: [{ id: "OTHER1", name: "Other", status: "ACTIVE" }],
    },
  ])("returns clean 404 for $label", async ({ locations }) => {
    const list = vi.fn().mockResolvedValue({ locations });
    const { catalog, search, entries } = createTestHandlers({ list });

    const response = await catalog(
      new Request(
        `https://example.test/api/catalog?location_id=${LOCATION_ID}`,
      ),
    );
    const serialized = await response.text();

    expect(response.status).toBe(404);
    expect(JSON.parse(serialized)).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "The requested location was not found.",
        requestId: "catalog-request-1",
      },
    });
    expect(serialized).not.toContain(LOCATION_ID);
    expect(search).not.toHaveBeenCalled();
    expect(entries[0]?.statusCode).toBe(404);
  });

  it("returns successful empty views for an empty Square catalog", async () => {
    const search = vi.fn().mockResolvedValue({});
    const { catalog, categories } = createTestHandlers({ search });

    const catalogResponse = await catalog(
      new Request(
        `https://example.test/api/catalog?location_id=${LOCATION_ID}`,
      ),
    );
    const categoriesResponse = await categories(
      new Request(
        `https://example.test/api/catalog/categories?location_id=${LOCATION_ID}`,
      ),
    );

    expect(await catalogResponse.json()).toEqual({ categories: [] });
    expect(await categoriesResponse.json()).toEqual({ categories: [] });
  });

  it.each([
    {
      label: "authentication",
      error: new SquareError({ statusCode: 401, message: "fake-auth-detail" }),
      status: 502,
      code: "SQUARE_AUTHENTICATION_ERROR",
    },
    {
      label: "rate limit",
      error: new SquareError({ statusCode: 429, message: "fake-rate-detail" }),
      status: 503,
      code: "SQUARE_RATE_LIMITED",
    },
    {
      label: "network",
      error: new TypeError("fake-network-detail"),
      status: 503,
      code: "SQUARE_UNAVAILABLE",
    },
  ])("sanitizes Catalog $label failures", async ({ error, status, code }) => {
    const search = vi.fn().mockRejectedValue(error);
    const { catalog, entries } = createTestHandlers({ search });

    const response = await catalog(
      new Request(
        `https://example.test/api/catalog?location_id=${LOCATION_ID}`,
      ),
    );
    const serialized = await response.text();

    expect(response.status).toBe(status);
    expect(JSON.parse(serialized)).toMatchObject({ error: { code } });
    expect(serialized).not.toContain("fake-");
    expect(entries[0]?.statusCode).toBe(status);
  });

  it("sanitizes a Locations authentication failure before Catalog is called", async () => {
    const list = vi.fn().mockRejectedValue(
      new SquareError({ statusCode: 401, message: "fake-location-auth" }),
    );
    const { categories, search } = createTestHandlers({ list });

    const response = await categories(
      new Request(
        `https://example.test/api/catalog/categories?location_id=${LOCATION_ID}`,
      ),
    );
    const serialized = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(serialized)).toMatchObject({
      error: { code: "SQUARE_AUTHENTICATION_ERROR" },
    });
    expect(serialized).not.toContain("fake-location-auth");
    expect(search).not.toHaveBeenCalled();
  });

  it("maps typed Catalog response errors and does not cache the failure", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        errors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }],
      })
      .mockResolvedValueOnce(catalogResponse())
      .mockResolvedValueOnce(categoryResponse());
    const { catalog, list } = createTestHandlers({ search });
    const request = () =>
      new Request(
        `https://example.test/api/catalog?location_id=${LOCATION_ID}`,
      );

    const failed = await catalog(request());
    expect(failed.status).toBe(503);
    const recovered = await catalog(request());
    expect(recovered.status).toBe(200);
    expect(list).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledTimes(3);
  });
});
