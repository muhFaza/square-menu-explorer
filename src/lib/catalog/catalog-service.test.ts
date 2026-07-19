import type { CatalogObject, Location } from "square";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { LocationsGateway } from "@/lib/locations/location-service";
import type {
  RawCatalogResult,
  SquareCatalogGateway,
} from "@/lib/square/catalog-gateway";

import { AsyncTtlCache } from "./catalog-cache";
import {
  createCatalogService,
  projectCatalogCategories,
} from "./catalog-service";

const LOCATION_ID = "LOCATION1";

function activeLocation(id = LOCATION_ID): Location {
  return { id, name: `Cafe ${id}`, status: "ACTIVE" };
}

function rawCatalog(): RawCatalogResult {
  const variation: CatalogObject.ItemVariation = {
    id: "VARIATION1",
    type: "ITEM_VARIATION",
    itemVariationData: {
      name: "Regular",
      priceMoney: { amount: BigInt(500), currency: "USD" },
    },
  };
  const item: CatalogObject.Item = {
    id: "ITEM1",
    type: "ITEM",
    itemData: {
      name: "Latte",
      categories: [{ id: "DRINKS" }],
      variations: [variation],
    },
  };
  const category: CatalogObject.Category = {
    id: "DRINKS",
    type: "CATEGORY",
    categoryData: { name: "Drinks" },
  };

  return { items: [item], relatedObjects: [category] };
}

function createService(
  locations: readonly Location[] = [activeLocation()],
  raw: RawCatalogResult = rawCatalog(),
) {
  const listLocations = vi.fn().mockResolvedValue(locations);
  const fetchCatalog = vi.fn().mockResolvedValue(raw);
  const locationsGateway: LocationsGateway = { listLocations };
  const catalogGateway: SquareCatalogGateway = { fetchCatalog };
  const cache = new AsyncTtlCache<Awaited<ReturnType<ReturnType<typeof createCatalogService>["getCatalog"]>>>();
  const service = createCatalogService({
    locationsGateway,
    catalogGateway,
    cache,
  });

  return { service, listLocations, fetchCatalog };
}

describe("createCatalogService", () => {
  it("validates an active location, retrieves, maps, and caches its catalog", async () => {
    const { service, listLocations, fetchCatalog } = createService();

    await expect(service.getCatalog(LOCATION_ID)).resolves.toEqual({
      categories: [
        {
          id: "DRINKS",
          name: "Drinks",
          items: [
            {
              id: "ITEM1",
              name: "Latte",
              description: null,
              category: "Drinks",
              image_url: null,
              variations: [
                {
                  id: "VARIATION1",
                  name: "Regular",
                  price: { amount: "500", currency: "USD" },
                },
              ],
            },
          ],
        },
      ],
    });
    await service.getCatalog(LOCATION_ID);

    expect(listLocations).toHaveBeenCalledOnce();
    expect(fetchCatalog).toHaveBeenCalledOnce();
  });

  it("groups items by separately fetched categories and keeps unresolved ones Uncategorized", async () => {
    function itemWith(
      id: string,
      name: string,
      categories?: readonly { id: string }[],
    ): CatalogObject.Item {
      return {
        id,
        type: "ITEM",
        itemData: {
          name,
          ...(categories ? { categories: [...categories] } : {}),
          variations: [
            {
              id: `${id}-var`,
              type: "ITEM_VARIATION",
              itemVariationData: {
                name: "Regular",
                priceMoney: { amount: BigInt(400), currency: "USD" },
              },
            },
          ],
        },
      };
    }
    const coffeeCategory: CatalogObject.Category = {
      id: "COFFEE",
      type: "CATEGORY",
      categoryData: { name: "Coffee" },
    };
    const raw: RawCatalogResult = {
      items: [
        itemWith("ESPRESSO", "Espresso", [{ id: "COFFEE" }]),
        itemWith("AMERICANO", "Americano"),
      ],
      relatedObjects: [coffeeCategory],
    };
    const { service } = createService([activeLocation()], raw);

    await expect(service.getCatalog(LOCATION_ID)).resolves.toMatchObject({
      categories: [
        { id: "COFFEE", name: "Coffee", items: [{ name: "Espresso" }] },
        {
          id: "uncategorized",
          name: "Uncategorized",
          items: [{ name: "Americano" }],
        },
      ],
    });
  });

  it("projects categories from the same cached catalog snapshot", async () => {
    const { service, listLocations, fetchCatalog } = createService();

    await service.getCatalog(LOCATION_ID);
    await expect(service.getCategories(LOCATION_ID)).resolves.toEqual({
      categories: [{ id: "DRINKS", name: "Drinks", item_count: 1 }],
    });

    expect(listLocations).toHaveBeenCalledOnce();
    expect(fetchCatalog).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent catalog and category requests", async () => {
    const listLocations = vi.fn().mockResolvedValue([activeLocation()]);
    let resolveCatalog!: (value: RawCatalogResult) => void;
    const pendingCatalog = new Promise<RawCatalogResult>((resolve) => {
      resolveCatalog = resolve;
    });
    const fetchCatalog = vi.fn(() => pendingCatalog);
    const service = createCatalogService({
      locationsGateway: { listLocations },
      catalogGateway: { fetchCatalog },
      cache: new AsyncTtlCache(),
    });

    const catalogRequest = service.getCatalog(LOCATION_ID);
    const categoriesRequest = service.getCategories(LOCATION_ID);
    await Promise.resolve();
    await Promise.resolve();

    expect(listLocations).toHaveBeenCalledOnce();
    resolveCatalog(rawCatalog());
    await expect(Promise.all([catalogRequest, categoriesRequest])).resolves.toHaveLength(2);
    expect(fetchCatalog).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "no locations", locations: [] },
    {
      label: "inactive location",
      locations: [{ id: LOCATION_ID, name: "Closed", status: "INACTIVE" }],
    },
    { label: "different active location", locations: [activeLocation("OTHER1")] },
  ])("returns clean NOT_FOUND for $label", async ({ locations }) => {
    const { service, fetchCatalog } = createService(locations as Location[]);

    await expect(service.getCatalog(LOCATION_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
      publicMessage: "The requested location was not found.",
    });
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("does not cache validation or retrieval failures", async () => {
    const listLocations = vi
      .fn<LocationsGateway["listLocations"]>()
      .mockResolvedValueOnce([])
      .mockResolvedValue([activeLocation()]);
    const fetchCatalog = vi
      .fn<SquareCatalogGateway["fetchCatalog"]>()
      .mockRejectedValueOnce(new Error("fake-upstream"))
      .mockResolvedValue(rawCatalog());
    const service = createCatalogService({
      locationsGateway: { listLocations },
      catalogGateway: { fetchCatalog },
      cache: new AsyncTtlCache(),
    });

    await expect(service.getCatalog(LOCATION_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.getCatalog(LOCATION_ID)).rejects.toThrow(
      "fake-upstream",
    );
    await expect(service.getCatalog(LOCATION_ID)).resolves.toMatchObject({
      categories: [{ id: "DRINKS" }],
    });
    expect(listLocations).toHaveBeenCalledTimes(3);
    expect(fetchCatalog).toHaveBeenCalledTimes(2);
  });
});

describe("projectCatalogCategories", () => {
  it("returns exact summaries and removes empty groups defensively", () => {
    expect(
      projectCatalogCategories({
        categories: [
          { id: "EMPTY", name: "Empty", items: [] },
          {
            id: "DRINKS",
            name: "Drinks",
            items: [
              {
                id: "ITEM1",
                name: "Latte",
                description: null,
                category: "Drinks",
                image_url: null,
                variations: [],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      categories: [{ id: "DRINKS", name: "Drinks", item_count: 1 }],
    });
  });
});
