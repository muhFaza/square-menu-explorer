import type {
  CatalogCategoriesResponse,
  CatalogResponse,
} from "@/types/catalog";

type Fetcher = typeof fetch;

export interface FetchCatalogOptions {
  readonly fetcher?: Fetcher;
  readonly signal?: AbortSignal;
}

export interface CatalogViewData {
  readonly catalog: CatalogResponse;
  readonly categorySummaries: CatalogCategoriesResponse;
}

export class CatalogApiError extends Error {
  constructor() {
    super("The menu is unavailable right now.");
    this.name = "CatalogApiError";
  }
}

function normalizeImageUrl(imageUrl: string | null): string | null {
  if (imageUrl === null) {
    return null;
  }

  const trimmedImageUrl = imageUrl.trim();
  if (trimmedImageUrl.length === 0) {
    return null;
  }

  try {
    const parsedImageUrl = new URL(trimmedImageUrl);
    return parsedImageUrl.protocol === "http:" || parsedImageUrl.protocol === "https:"
      ? parsedImageUrl.href
      : null;
  } catch {
    return null;
  }
}

function normalizeCatalogImages(catalog: CatalogResponse): CatalogResponse {
  return {
    categories: catalog.categories.map((category) => ({
      ...category,
      items: category.items.map((item) => ({
        ...item,
        image_url: normalizeImageUrl(item.image_url),
      })),
    })),
  };
}

// Same-repo backend, so only the top-level envelope is checked before typing.
function hasCategoriesArray(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { categories?: unknown }).categories)
  );
}

async function parseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new CatalogApiError();
  }

  try {
    return await response.json();
  } catch {
    throw new CatalogApiError();
  }
}

export function reconcileCatalogResponses(
  catalog: CatalogResponse,
  categorySummaries: CatalogCategoriesResponse,
): CatalogViewData {
  if (catalog.categories.length !== categorySummaries.categories.length) {
    throw new CatalogApiError();
  }

  const seenGroupIds = new Set<string>();
  const seenSummaryIds = new Set<string>();

  for (const [index, group] of catalog.categories.entries()) {
    const summary = categorySummaries.categories[index];
    if (
      seenGroupIds.has(group.id) ||
      seenSummaryIds.has(summary.id) ||
      group.id !== summary.id ||
      group.name !== summary.name ||
      group.items.length !== summary.item_count
    ) {
      throw new CatalogApiError();
    }
    seenGroupIds.add(group.id);
    seenSummaryIds.add(summary.id);
  }

  return { catalog, categorySummaries };
}

export async function fetchCatalogForLocation(
  locationId: string,
  { fetcher = fetch, signal }: FetchCatalogOptions = {},
): Promise<CatalogViewData> {
  const encodedLocationId = encodeURIComponent(locationId);
  const requestOptions: RequestInit = {
    headers: { accept: "application/json" },
    signal,
  };
  const [catalogBody, categoriesBody] = await Promise.all([
    fetcher(
      `/api/catalog?location_id=${encodedLocationId}`,
      requestOptions,
    ).then(parseJson),
    fetcher(
      `/api/catalog/categories?location_id=${encodedLocationId}`,
      requestOptions,
    ).then(parseJson),
  ]);

  if (!hasCategoriesArray(catalogBody) || !hasCategoriesArray(categoriesBody)) {
    throw new CatalogApiError();
  }

  return reconcileCatalogResponses(
    normalizeCatalogImages(catalogBody as CatalogResponse),
    categoriesBody as CatalogCategoriesResponse,
  );
}
