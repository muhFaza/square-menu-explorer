import { SquareError } from "square";
import type { CatalogObject } from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSquareCatalogGateway,
  fetchAllCatalogPages,
  type RawCatalogResult,
  type SquareCatalogClient,
} from "./catalog-gateway";

function item(id: string): CatalogObject.Item {
  return { id, type: "ITEM" };
}

function category(id: string, name?: string): CatalogObject.Category {
  return {
    id,
    type: "CATEGORY",
    ...(name ? { categoryData: { name } } : {}),
  };
}

function image(id: string): CatalogObject.Image {
  return { id, type: "IMAGE" };
}

function clientWithSearch(
  search: SquareCatalogClient["catalog"]["search"],
): SquareCatalogClient {
  return { catalog: { search } };
}

describe("fetchAllCatalogPages", () => {
  it("requests every ITEM and CATEGORY page with the required contract", async () => {
    const firstItem = item("item-1");
    const secondItem = item("item-2");
    const relatedImage = image("image-1");
    const firstCategory = category("category-1", "Coffee");
    const secondCategory = category("category-2", "Tea");
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({
        objects: [firstItem],
        relatedObjects: [relatedImage],
        cursor: "item-page-2",
      })
      .mockResolvedValueOnce({
        objects: [secondItem],
      })
      .mockResolvedValueOnce({
        objects: [firstCategory],
        cursor: "category-page-2",
      })
      .mockResolvedValueOnce({
        objects: [secondCategory],
      });

    const result = await fetchAllCatalogPages(clientWithSearch(search));

    expect(search).toHaveBeenNthCalledWith(1, {
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
    });
    expect(search).toHaveBeenNthCalledWith(2, {
      objectTypes: ["ITEM"],
      includeRelatedObjects: true,
      cursor: "item-page-2",
    });
    expect(search).toHaveBeenNthCalledWith(3, {
      objectTypes: ["CATEGORY"],
    });
    expect(search).toHaveBeenNthCalledWith(4, {
      objectTypes: ["CATEGORY"],
      cursor: "category-page-2",
    });
    expect(result).toEqual({
      items: [firstItem, secondItem],
      relatedObjects: [relatedImage, firstCategory, secondCategory],
    });
  });

  it("returns complete empty arrays when Square omits result collections", async () => {
    const search = vi.fn().mockResolvedValue({});

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).resolves.toEqual({ items: [], relatedObjects: [] });
  });

  it("deduplicates repeated related objects by ID with first-seen order", async () => {
    const firstCategory = category("category-1", "First snapshot");
    const repeatedCategory = category("category-1", "Repeated snapshot");
    const secondCategory = category("category-2");
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({
        relatedObjects: [firstCategory],
        cursor: "next-page",
      })
      .mockResolvedValueOnce({
        relatedObjects: [repeatedCategory, secondCategory],
      })
      .mockResolvedValueOnce({});

    const result = await fetchAllCatalogPages(clientWithSearch(search));

    expect(result.relatedObjects).toEqual([firstCategory, secondCategory]);
    expect(result.relatedObjects[0]).toBe(firstCategory);
  });

  it.each(["", "   ", " padded-cursor", null, 42])(
    "rejects an invalid response cursor %# instead of issuing another request",
    async (cursor) => {
      const search = vi.fn().mockResolvedValue({ cursor });

      await expect(
        fetchAllCatalogPages(
          clientWithSearch(
            search as SquareCatalogClient["catalog"]["search"],
          ),
        ),
      ).rejects.toMatchObject({
        code: "SQUARE_UNAVAILABLE",
        statusCode: 502,
        publicMessage: "Menu data is temporarily unavailable.",
        message: "Square SearchCatalogObjects returned an invalid cursor.",
      });
      expect(search).toHaveBeenCalledOnce();
    },
  );

  it("detects a cursor cycle before making a repeated page request", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({ cursor: "cursor-a" })
      .mockResolvedValueOnce({ cursor: "cursor-b" })
      .mockResolvedValueOnce({ cursor: "cursor-a" });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message: "Square SearchCatalogObjects returned a repeated cursor.",
    });
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("stops at the configured page ceiling", async () => {
    const search = vi.fn().mockResolvedValue({ cursor: "another-page" });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search), { maxPages: 1 }),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message: "Square SearchCatalogObjects exceeded 1 pages.",
    });
    expect(search).toHaveBeenCalledOnce();
  });

  it("rejects an invalid page ceiling before contacting Square", async () => {
    const search = vi.fn();

    await expect(
      fetchAllCatalogPages(clientWithSearch(search), { maxPages: 0 }),
    ).rejects.toThrow("maxPages must be a positive safe integer.");
    expect(search).not.toHaveBeenCalled();
  });

  it("fails the whole retrieval when a later page fails", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({
        objects: [item("must-not-return")],
        cursor: "next-page",
      })
      .mockRejectedValueOnce(
        new SquareError({
          statusCode: 500,
          message: "fake-raw-later-page-error",
        }),
      );
    let result: RawCatalogResult | undefined;

    await expect(
      (async () => {
        result = await fetchAllCatalogPages(clientWithSearch(search));
      })(),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 503,
      publicMessage: "Menu data is temporarily unavailable.",
    });
    expect(result).toBeUndefined();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      error: new SquareError({ statusCode: 401, message: "fake-auth-detail" }),
      code: "SQUARE_AUTHENTICATION_ERROR",
      statusCode: 502,
      publicMessage: "Menu data is temporarily unavailable.",
    },
    {
      error: new SquareError({ statusCode: 429, message: "fake-rate-detail" }),
      code: "SQUARE_RATE_LIMITED",
      statusCode: 503,
      publicMessage:
        "Menu data is temporarily unavailable. Please try again shortly.",
    },
    {
      error: new TypeError("fake-network-detail"),
      code: "SQUARE_UNAVAILABLE",
      statusCode: 503,
      publicMessage: "Menu data is temporarily unavailable.",
    },
  ])(
    "maps a catalog upstream failure to $code",
    async ({ error, code, statusCode, publicMessage }) => {
      const search = vi.fn().mockRejectedValue(error);

      await expect(
        fetchAllCatalogPages(clientWithSearch(search)),
      ).rejects.toMatchObject({ code, statusCode, publicMessage });
    },
  );

  it("maps typed response errors and discards any accompanying data", async () => {
    const search = vi.fn().mockResolvedValue({
      errors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }],
      objects: [item("must-not-return")],
    });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_RATE_LIMITED",
      statusCode: 503,
      publicMessage:
        "Menu data is temporarily unavailable. Please try again shortly.",
    });
  });

  it("rejects a non-ITEM primary object", async () => {
    const search = vi.fn().mockResolvedValue({
      objects: [category("unexpected-category")],
    });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message:
        "Square SearchCatalogObjects returned a non-ITEM primary object.",
    });
  });

  it("rejects an unidentifiable related object", async () => {
    const relatedObject: CatalogObject.Category = { type: "CATEGORY" };
    const search = vi.fn().mockResolvedValue({
      relatedObjects: [relatedObject],
    });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message:
        "Square SearchCatalogObjects returned a related object without an ID.",
    });
  });

  it("merges separately fetched CATEGORY objects after the item related objects", async () => {
    const soleItem = item("item-1");
    const relatedImage = image("image-1");
    const coffee = category("category-coffee", "Coffee");
    const tea = category("category-tea", "Tea");
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({
        objects: [soleItem],
        relatedObjects: [relatedImage],
      })
      .mockResolvedValueOnce({ objects: [coffee, tea] });

    const result = await fetchAllCatalogPages(clientWithSearch(search));

    expect(result).toEqual({
      items: [soleItem],
      relatedObjects: [relatedImage, coffee, tea],
    });
  });

  it("fails the whole retrieval when a category page fails after the item search", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({ objects: [item("item-1")] })
      .mockRejectedValueOnce(
        new SquareError({
          statusCode: 500,
          message: "fake-raw-category-page-error",
        }),
      );

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 503,
      publicMessage: "Menu data is temporarily unavailable.",
    });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("detects a cursor cycle across category pages", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ objects: [category("c-1")], cursor: "cat-a" })
      .mockResolvedValueOnce({ objects: [category("c-2")], cursor: "cat-a" });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message: "Square SearchCatalogObjects returned a repeated cursor.",
    });
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("rejects a non-CATEGORY primary object on the category search", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ objects: [item("unexpected-item")] });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message:
        "Square SearchCatalogObjects returned a non-CATEGORY primary object.",
    });
  });

  it("rejects an unidentifiable category on the category search", async () => {
    const search = vi
      .fn<SquareCatalogClient["catalog"]["search"]>()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ objects: [{ type: "CATEGORY" }] });

    await expect(
      fetchAllCatalogPages(clientWithSearch(search)),
    ).rejects.toMatchObject({
      code: "SQUARE_UNAVAILABLE",
      statusCode: 502,
      message: "Square SearchCatalogObjects returned a category without an ID.",
    });
  });
});

describe("createSquareCatalogGateway", () => {
  it("keeps client construction lazy until retrieval", async () => {
    const search = vi.fn().mockResolvedValue({});
    const clientFactory = vi.fn(() => clientWithSearch(search));
    const gateway = createSquareCatalogGateway(clientFactory);

    expect(clientFactory).not.toHaveBeenCalled();
    await expect(gateway.fetchCatalog()).resolves.toEqual({
      items: [],
      relatedObjects: [],
    });
    expect(clientFactory).toHaveBeenCalledOnce();
  });
});
