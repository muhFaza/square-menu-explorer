import type {
  CatalogCategoriesResponse,
  CatalogCategoryGroupDto,
  CatalogCategorySummaryDto,
  CatalogItemDto,
  CatalogMoneyDto,
  CatalogResponse,
  CatalogVariationDto,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isMoney(value: unknown): value is CatalogMoneyDto {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["amount", "currency"]) &&
    typeof value.amount === "string" &&
    /^-?\d+$/.test(value.amount) &&
    typeof value.currency === "string" &&
    /^[A-Z]{3}$/.test(value.currency)
  );
}

function isVariation(value: unknown): value is CatalogVariationDto {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "name", "price"]) &&
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    (value.price === null || isMoney(value.price))
  );
}

function isItem(value: unknown): value is CatalogItemDto {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "name",
      "description",
      "category",
      "image_url",
      "variations",
    ]) &&
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    (value.description === null || typeof value.description === "string") &&
    isNonemptyString(value.category) &&
    (value.image_url === null || typeof value.image_url === "string") &&
    Array.isArray(value.variations) &&
    value.variations.length > 0 &&
    value.variations.every(isVariation)
  );
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

function isCategoryGroup(value: unknown): value is CatalogCategoryGroupDto {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "name", "items"]) &&
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(
      (item) => isItem(item) && item.category === value.name,
    )
  );
}

function isCatalogResponse(value: unknown): value is CatalogResponse {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["categories"]) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategoryGroup)
  );
}

function isCategorySummary(
  value: unknown,
): value is CatalogCategorySummaryDto {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "name", "item_count"]) &&
    isNonemptyString(value.id) &&
    isNonemptyString(value.name) &&
    typeof value.item_count === "number" &&
    Number.isSafeInteger(value.item_count) &&
    value.item_count > 0
  );
}

function isCategoriesResponse(
  value: unknown,
): value is CatalogCategoriesResponse {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["categories"]) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategorySummary)
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

  if (!isCatalogResponse(catalogBody) || !isCategoriesResponse(categoriesBody)) {
    throw new CatalogApiError();
  }

  return reconcileCatalogResponses(
    normalizeCatalogImages(catalogBody),
    categoriesBody,
  );
}
