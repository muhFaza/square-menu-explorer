import { describe, expect, it, vi } from "vitest";

import {
  CatalogApiError,
  fetchCatalogForLocation,
  reconcileCatalogResponses,
} from "./catalog-api";

const catalog = {
  categories: [
    {
      id: "CATEGORY1",
      name: "Coffee",
      items: [
        {
          id: "ITEM1",
          name: "Latte",
          description: null,
          category: "Coffee",
          image_url: null,
          variations: [
            {
              id: "VARIATION1",
              name: "Regular",
              price: { amount: "325", currency: "USD" },
            },
          ],
        },
      ],
    },
  ],
} as const;

const summaries = {
  categories: [{ id: "CATEGORY1", name: "Coffee", item_count: 1 }],
} as const;

describe("fetchCatalogForLocation", () => {
  it("requests both encoded same-origin endpoints concurrently with one signal", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(String(input).includes("/categories") ? summaries : catalog),
    );

    await expect(
      fetchCatalogForLocation("LOCATION / 1", {
        fetcher,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ catalog, categorySummaries: summaries });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/catalog?location_id=LOCATION%20%2F%201",
      { headers: { accept: "application/json" }, signal: controller.signal },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/catalog/categories?location_id=LOCATION%20%2F%201",
      { headers: { accept: "application/json" }, signal: controller.signal },
    );
  });

  it("rejects a fast HTTP failure without waiting for the stalled sibling", async () => {
    let resolveCategories: ((response: Response) => void) | undefined;
    const stalledCategories = new Promise<Response>((resolve) => {
      resolveCategories = resolve;
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockReturnValueOnce(stalledCategories);

    const result = fetchCatalogForLocation("LOCATION1", { fetcher });

    await expect(result).rejects.toEqual(new CatalogApiError());
    expect(resolveCategories).toBeTypeOf("function");
  });

  it.each([
    ["blank", "   "],
    ["relative", "/menu/latte.jpg"],
    ["invalid", "not a URL"],
    ["unsafe protocol", "javascript:alert(1)"],
  ])("normalizes a %s image URL to the fallback null", async (_, imageUrl) => {
    const responseWithImage = {
      categories: [
        {
          ...catalog.categories[0],
          items: [{ ...catalog.categories[0].items[0], image_url: imageUrl }],
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(responseWithImage))
      .mockResolvedValueOnce(Response.json(summaries));

    await expect(
      fetchCatalogForLocation("LOCATION1", { fetcher }),
    ).resolves.toMatchObject({
      catalog: { categories: [{ items: [{ image_url: null }] }] },
    });
  });

  it("trims and canonicalizes a valid HTTP image URL", async () => {
    const responseWithImage = {
      categories: [
        {
          ...catalog.categories[0],
          items: [
            {
              ...catalog.categories[0].items[0],
              image_url: "  https://images.example.com/latte.jpg  ",
            },
          ],
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(responseWithImage))
      .mockResolvedValueOnce(Response.json(summaries));

    await expect(
      fetchCatalogForLocation("LOCATION1", { fetcher }),
    ).resolves.toMatchObject({
      catalog: {
        categories: [
          {
            items: [
              { image_url: "https://images.example.com/latte.jpg" },
            ],
          },
        ],
      },
    });
  });

  it.each([
    ["non-success status", new Response(null, { status: 503 }), Response.json(summaries)],
    ["invalid JSON", new Response("not-json"), Response.json(summaries)],
    ["count drift", Response.json(catalog), Response.json({ categories: [{ ...summaries.categories[0], item_count: 0 }] })],
  ])("rejects %s with one browser-safe error", async (_, first, second) => {
    const fetcher = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await expect(fetchCatalogForLocation("LOCATION1", { fetcher })).rejects.toEqual(
      new CatalogApiError(),
    );
  });
});

describe("reconcileCatalogResponses", () => {
  it("rejects category metadata or count drift instead of mixing snapshots", () => {
    expect(() =>
      reconcileCatalogResponses(catalog, {
        categories: [{ ...summaries.categories[0], item_count: 2 }],
      }),
    ).toThrow(CatalogApiError);
    expect(() =>
      reconcileCatalogResponses(catalog, {
        categories: [{ ...summaries.categories[0], id: "OTHER" }],
      }),
    ).toThrow(CatalogApiError);
  });
});
