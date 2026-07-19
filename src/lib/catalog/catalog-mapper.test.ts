import type { CatalogObject, Money } from "square";
import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/lib/errors/application-error";
import type { RawCatalogResult } from "@/lib/square/catalog-gateway";

import {
  isCatalogObjectPresentAtLocation,
  mapCatalogForLocation,
  UNCATEGORIZED_CATEGORY_ID,
} from "./catalog-mapper";

const LOCATION_ID = "location-a";

function variation(
  id: string,
  name: string,
  options: Partial<CatalogObject.ItemVariation> & {
    priceMoney?: Money;
  } = {},
): CatalogObject.ItemVariation {
  const { priceMoney, ...objectOptions } = options;

  return {
    id,
    type: "ITEM_VARIATION",
    itemVariationData: {
      name,
      ...(priceMoney ? { priceMoney } : {}),
    },
    ...objectOptions,
  };
}

function item(
  id: string,
  name: string,
  options: Partial<CatalogObject.Item> & {
    variations?: CatalogObject[];
    categoryIds?: string[];
    legacyCategoryId?: string;
    imageIds?: string[];
    description?: string;
    descriptionPlaintext?: string;
  } = {},
): CatalogObject.Item {
  const {
    variations = [variation(`${id}-variation`, "Regular")],
    categoryIds,
    legacyCategoryId,
    imageIds,
    description,
    descriptionPlaintext,
    ...objectOptions
  } = options;

  return {
    id,
    type: "ITEM",
    itemData: {
      name,
      variations,
      ...(categoryIds
        ? { categories: categoryIds.map((categoryId) => ({ id: categoryId })) }
        : {}),
      ...(legacyCategoryId ? { categoryId: legacyCategoryId } : {}),
      ...(imageIds ? { imageIds } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(descriptionPlaintext !== undefined ? { descriptionPlaintext } : {}),
    },
    ...objectOptions,
  };
}

function category(id: string, name?: string): CatalogObject.Category {
  return {
    id,
    type: "CATEGORY",
    ...(name === undefined ? {} : { categoryData: { name } }),
  };
}

function image(id: string, url?: string): CatalogObject.Image {
  return {
    id,
    type: "IMAGE",
    ...(url === undefined ? {} : { imageData: { url } }),
  };
}

function rawCatalog(
  items: CatalogObject.Item[],
  relatedObjects: CatalogObject[] = [],
): RawCatalogResult {
  return { items, relatedObjects };
}

describe("isCatalogObjectPresentAtLocation", () => {
  it.each([
    {
      label: "defaults omitted presentAtAllLocations to true",
      object: {},
      expected: true,
    },
    {
      label: "keeps an all-location object",
      object: { presentAtAllLocations: true },
      expected: true,
    },
    {
      label: "lets an absent ID override all-location presence",
      object: {
        presentAtAllLocations: true,
        presentAtLocationIds: [LOCATION_ID],
        absentAtLocationIds: [LOCATION_ID],
      },
      expected: false,
    },
    {
      label: "defaults an omitted all-location flag except an absent ID",
      object: { absentAtLocationIds: [LOCATION_ID] },
      expected: false,
    },
    {
      label: "requires an explicit present ID when the flag is false",
      object: { presentAtAllLocations: false },
      expected: false,
    },
    {
      label: "keeps an explicitly present location when the flag is false",
      object: {
        presentAtAllLocations: false,
        presentAtLocationIds: [LOCATION_ID],
      },
      expected: true,
    },
    {
      label: "uses the present list in the false branch even if absent also lists it",
      object: {
        presentAtAllLocations: false,
        presentAtLocationIds: [LOCATION_ID],
        absentAtLocationIds: [LOCATION_ID],
      },
      expected: true,
    },
  ])("$label", ({ object, expected }) => {
    expect(isCatalogObjectPresentAtLocation(object, LOCATION_ID)).toBe(expected);
  });
});

describe("mapCatalogForLocation", () => {
  it("joins related objects, preserves order, and groups items by category", () => {
    const result = mapCatalogForLocation(
      rawCatalog(
        [
          item("latte", " Latte ", {
            categoryIds: ["drinks"],
            imageIds: ["missing-image", "latte-image"],
            description: "deprecated fallback",
            descriptionPlaintext: " Steamed milk and espresso ",
            variations: [
              variation("latte-small", " Small ", {
                priceMoney: { amount: BigInt(450), currency: "USD" },
              }),
              variation("latte-large", "Large", {
                priceMoney: { amount: BigInt(575), currency: "USD" },
              }),
            ],
          }),
          item("tea", "Tea", { categoryIds: ["drinks"] }),
          item("croissant", "Croissant", { categoryIds: ["bakery"] }),
        ],
        [
          category("drinks", " Drinks "),
          category("bakery", "Bakery"),
          image("latte-image", " https://example.test/latte.jpg "),
        ],
      ),
      LOCATION_ID,
    );

    expect(result).toEqual({
      categories: [
        {
          id: "drinks",
          name: "Drinks",
          items: [
            {
              id: "latte",
              name: "Latte",
              description: "Steamed milk and espresso",
              category: "Drinks",
              image_url: "https://example.test/latte.jpg",
              variations: [
                {
                  id: "latte-small",
                  name: "Small",
                  price: { amount: "450", currency: "USD" },
                },
                {
                  id: "latte-large",
                  name: "Large",
                  price: { amount: "575", currency: "USD" },
                },
              ],
            },
            expect.objectContaining({ id: "tea", category: "Drinks" }),
          ],
        },
        {
          id: "bakery",
          name: "Bakery",
          items: [
            expect.objectContaining({
              id: "croissant",
              category: "Bakery",
            }),
          ],
        },
      ],
    });
  });

  it("filters items and nested variations independently for the location", () => {
    const result = mapCatalogForLocation(
      rawCatalog([
        item("absent-item", "Absent item", {
          absentAtLocationIds: [LOCATION_ID],
        }),
        item("no-present-variations", "No choices", {
          variations: [
            variation("elsewhere", "Elsewhere", {
              presentAtAllLocations: false,
              presentAtLocationIds: ["location-b"],
            }),
          ],
        }),
        item("mixed", "Mixed availability", {
          presentAtAllLocations: false,
          presentAtLocationIds: [LOCATION_ID],
          variations: [
            variation("available", "Available", {
              presentAtAllLocations: false,
              presentAtLocationIds: [LOCATION_ID],
            }),
            variation("unavailable", "Unavailable", {
              absentAtLocationIds: [LOCATION_ID],
            }),
          ],
        }),
      ]),
      LOCATION_ID,
    );

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.items.map(({ id }) => id)).toEqual(["mixed"]);
    expect(result.categories[0]?.items[0]?.variations).toEqual([
      { id: "available", name: "Available", price: null },
    ]);
  });

  it("uses the first resolvable ordered category, then the legacy fallback", () => {
    const result = mapCatalogForLocation(
      rawCatalog(
        [
          item("modern", "Modern", {
            categoryIds: ["missing", "nameless", "resolved", "later"],
            legacyCategoryId: "legacy",
          }),
          item("legacy-item", "Legacy", {
            categoryIds: ["missing"],
            legacyCategoryId: "legacy",
          }),
        ],
        [
          category("nameless"),
          category("resolved", "Resolved first"),
          category("later", "Resolved later"),
          category("legacy", "Legacy category"),
        ],
      ),
      LOCATION_ID,
    );

    expect(
      result.categories.map(({ id, items }) => ({
        id,
        items: items.map((catalogItem) => catalogItem.id),
      })),
    ).toEqual([
      { id: "resolved", items: ["modern"] },
      { id: "legacy", items: ["legacy-item"] },
    ]);
  });

  it("groups unresolved categories under a synthetic Uncategorized category", () => {
    const result = mapCatalogForLocation(
      rawCatalog([
        item("without-category", "No category"),
        item("broken-reference", "Broken category", {
          categoryIds: ["not-returned"],
        }),
      ]),
      LOCATION_ID,
    );

    expect(result.categories).toEqual([
      {
        id: UNCATEGORIZED_CATEGORY_ID,
        name: "Uncategorized",
        items: [
          expect.objectContaining({
            id: "without-category",
            category: "Uncategorized",
          }),
          expect.objectContaining({
            id: "broken-reference",
            category: "Uncategorized",
          }),
        ],
      },
    ]);
  });

  it("uses nullable optional fields and the legacy object image fallback", () => {
    const withFallbackImage = item("fallback-image", "Fallback image", {
      imageIds: ["unresolved"],
      description: "  fallback description  ",
    });
    withFallbackImage.imageId = "legacy-image";

    const result = mapCatalogForLocation(
      rawCatalog(
        [withFallbackImage, item("nullable", "Nullable")],
        [image("legacy-image", "https://example.test/fallback.jpg")],
      ),
      LOCATION_ID,
    );

    expect(result.categories[0]?.items).toEqual([
      expect.objectContaining({
        id: "fallback-image",
        description: "fallback description",
        image_url: "https://example.test/fallback.jpg",
      }),
      expect.objectContaining({
        id: "nullable",
        description: null,
        image_url: null,
        variations: [
          { id: "nullable-variation", name: "Regular", price: null },
        ],
      }),
    ]);
  });

  it("preserves an unsafe-for-number bigint and serializes the DTO as JSON", () => {
    const result = mapCatalogForLocation(
      rawCatalog([
        item("precise", "Precise", {
          variations: [
            variation("precise-price", "Priced", {
              priceMoney: {
                amount: BigInt("9007199254740993"),
                currency: "JPY",
              },
            }),
          ],
        }),
      ]),
      LOCATION_ID,
    );

    expect(result.categories[0]?.items[0]?.variations[0]?.price).toEqual({
      amount: "9007199254740993",
      currency: "JPY",
    });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("returns an empty grouped response for an empty catalog", () => {
    expect(mapCatalogForLocation(rawCatalog([]), LOCATION_ID)).toEqual({
      categories: [],
    });
  });

  it.each([
    {
      label: "item ID",
      mutate: (catalogItem: CatalogObject.Item) => {
        catalogItem.id = "   ";
      },
      message: "item at index 0 ID is missing",
    },
    {
      label: "item data",
      mutate: (catalogItem: CatalogObject.Item) => {
        delete catalogItem.itemData;
      },
      message: "item malformed data is missing",
    },
    {
      label: "item name",
      mutate: (catalogItem: CatalogObject.Item) => {
        catalogItem.itemData!.name = null;
      },
      message: "item malformed name is missing",
    },
    {
      label: "variation ID",
      mutate: (catalogItem: CatalogObject.Item) => {
        catalogItem.itemData!.variations![0]!.id = "";
      },
      message: "variation at index 0 ID is missing",
    },
    {
      label: "variation data",
      mutate: (catalogItem: CatalogObject.Item) => {
        const firstVariation = catalogItem.itemData!.variations![0]!;
        if (firstVariation.type === "ITEM_VARIATION") {
          delete firstVariation.itemVariationData;
        }
      },
      message: "variation malformed-variation data is missing",
    },
    {
      label: "variation name",
      mutate: (catalogItem: CatalogObject.Item) => {
        const firstVariation = catalogItem.itemData!.variations![0]!;
        if (firstVariation.type === "ITEM_VARIATION") {
          firstVariation.itemVariationData!.name = " ";
        }
      },
      message: "variation malformed-variation name is missing",
    },
  ])("fails atomically for a present malformed $label", ({ mutate, message }) => {
    const malformedItem = item("malformed", "Valid name", {
      variations: [variation("malformed-variation", "Valid variation")],
    });
    mutate(malformedItem);

    expect(() =>
      mapCatalogForLocation(rawCatalog([malformedItem]), LOCATION_ID),
    ).toThrowError(
      expect.objectContaining({
        code: "SQUARE_UNAVAILABLE",
        statusCode: 502,
        publicMessage: "Menu data is temporarily unavailable.",
        message: expect.stringContaining(message),
      }) as ApplicationError,
    );
  });

  it("rejects a non-variation nested catalog object", () => {
    const malformedItem = item("item", "Item", {
      variations: [category("not-a-variation", "Wrong type")],
    });

    expect(() =>
      mapCatalogForLocation(rawCatalog([malformedItem]), LOCATION_ID),
    ).toThrowError(
      expect.objectContaining({
        code: "SQUARE_UNAVAILABLE",
        message: expect.stringContaining("non-variation object"),
      }) as ApplicationError,
    );
  });

  it.each([
    {
      label: "amount",
      money: { currency: "USD" } as Money,
      message: "missing an integer amount",
    },
    {
      label: "currency",
      money: { amount: BigInt(500) } as Money,
      message: "missing its currency",
    },
  ])("rejects an incomplete money $label", ({ money, message }) => {
    const malformedItem = item("item", "Item", {
      variations: [variation("variation", "Variation", { priceMoney: money })],
    });

    expect(() =>
      mapCatalogForLocation(rawCatalog([malformedItem]), LOCATION_ID),
    ).toThrowError(
      expect.objectContaining({
        code: "SQUARE_UNAVAILABLE",
        message: expect.stringContaining(message),
      }) as ApplicationError,
    );
  });

  it("rejects related objects without an ID", () => {
    expect(() =>
      mapCatalogForLocation(
        rawCatalog([item("item", "Item")], [category("", "Category")]),
        LOCATION_ID,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "SQUARE_UNAVAILABLE",
        message: "A related Square catalog object is missing its ID.",
      }) as ApplicationError,
    );
  });

  it("rejects a blank location before mapping", () => {
    expect(() => mapCatalogForLocation(rawCatalog([]), "   ")).toThrow(
      "locationId must be a non-empty string.",
    );
  });
});
