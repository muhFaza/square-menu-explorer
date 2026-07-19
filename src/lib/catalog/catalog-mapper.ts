import type { CatalogObject, Money } from "square";

import { ApplicationError } from "@/lib/errors/application-error";
import type { RawCatalogResult } from "@/lib/square/catalog-gateway";
import type {
  CatalogCategoryGroupDto,
  CatalogItemDto,
  CatalogMoneyDto,
  CatalogResponse,
  CatalogVariationDto,
} from "@/types/catalog";

export const UNCATEGORIZED_CATEGORY_ID = "uncategorized";
export const UNCATEGORIZED_CATEGORY_NAME = "Uncategorized";

interface ResolvedCategory {
  readonly id: string;
  readonly name: string;
}

interface RelatedObjectIndexes {
  readonly categoriesById: ReadonlyMap<string, ResolvedCategory>;
  readonly imageUrlsById: ReadonlyMap<string, string>;
}

function createCatalogContractError(message: string): ApplicationError {
  return new ApplicationError({
    code: "SQUARE_UNAVAILABLE",
    statusCode: 502,
    message,
    publicMessage: "Menu data is temporarily unavailable.",
  });
}

function nullableTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireTrimmed(
  value: string | null | undefined,
  context: string,
): string {
  const trimmed = nullableTrimmed(value);
  if (!trimmed) {
    throw createCatalogContractError(`${context} is missing.`);
  }

  return trimmed;
}

/**
 * Applies Square's CatalogObject location rules exactly. Omitted
 * presentAtAllLocations defaults to true; the corresponding exception list wins.
 */
export function isCatalogObjectPresentAtLocation(
  object: Pick<
    CatalogObject,
    "presentAtAllLocations" | "presentAtLocationIds" | "absentAtLocationIds"
  >,
  locationId: string,
): boolean {
  if (object.presentAtAllLocations === false) {
    return object.presentAtLocationIds?.includes(locationId) ?? false;
  }

  return !(object.absentAtLocationIds?.includes(locationId) ?? false);
}

function indexRelatedObjects(
  relatedObjects: RawCatalogResult["relatedObjects"],
): RelatedObjectIndexes {
  const categoriesById = new Map<string, ResolvedCategory>();
  const imageUrlsById = new Map<string, string>();

  for (const object of relatedObjects) {
    const id = nullableTrimmed(object.id);
    if (!id) {
      throw createCatalogContractError(
        "A related Square catalog object is missing its ID.",
      );
    }

    if (object.type === "CATEGORY") {
      const name = nullableTrimmed(object.categoryData?.name);
      if (name && !categoriesById.has(id)) {
        categoriesById.set(id, { id, name });
      }
    }

    if (object.type === "IMAGE") {
      const url = nullableTrimmed(object.imageData?.url);
      if (url && !imageUrlsById.has(id)) {
        imageUrlsById.set(id, url);
      }
    }
  }

  return { categoriesById, imageUrlsById };
}

function resolveCategory(
  itemData: NonNullable<CatalogObject.Item["itemData"]>,
  categoriesById: RelatedObjectIndexes["categoriesById"],
): ResolvedCategory {
  const categoryIds = [
    ...(itemData.categories ?? []).map(({ id }) => id),
    itemData.categoryId,
  ];

  for (const candidateId of categoryIds) {
    const id = nullableTrimmed(candidateId);
    if (!id) {
      continue;
    }

    const category = categoriesById.get(id);
    if (category) {
      return category;
    }
  }

  return {
    id: UNCATEGORIZED_CATEGORY_ID,
    name: UNCATEGORIZED_CATEGORY_NAME,
  };
}

function resolveImageUrl(
  item: CatalogObject.Item,
  imageUrlsById: RelatedObjectIndexes["imageUrlsById"],
): string | null {
  const imageIds = [...(item.itemData?.imageIds ?? []), item.imageId];

  for (const candidateId of imageIds) {
    const id = nullableTrimmed(candidateId);
    if (!id) {
      continue;
    }

    const url = imageUrlsById.get(id);
    if (url) {
      return url;
    }
  }

  return null;
}

function mapMoney(money: Money | undefined): CatalogMoneyDto | null {
  if (!money) {
    return null;
  }

  if (typeof money.amount !== "bigint") {
    throw createCatalogContractError(
      "A Square catalog variation price is missing an integer amount.",
    );
  }

  const currency = nullableTrimmed(money.currency);
  if (!currency) {
    throw createCatalogContractError(
      "A Square catalog variation price is missing its currency.",
    );
  }

  return {
    amount: money.amount.toString(),
    currency,
  };
}

function mapAvailableVariations(
  item: CatalogObject.Item,
  locationId: string,
): CatalogVariationDto[] {
  const variations = item.itemData?.variations ?? [];

  return variations.flatMap((variation, variationIndex) => {
    if (variation.type !== "ITEM_VARIATION") {
      throw createCatalogContractError(
        `Square catalog item ${item.id} has a non-variation object at variation index ${variationIndex}.`,
      );
    }

    if (!isCatalogObjectPresentAtLocation(variation, locationId)) {
      return [];
    }

    const id = requireTrimmed(
      variation.id,
      `Square catalog variation at index ${variationIndex} ID`,
    );
    if (!variation.itemVariationData) {
      throw createCatalogContractError(
        `Square catalog variation ${id} data is missing.`,
      );
    }

    return [
      {
        id,
        name: requireTrimmed(
          variation.itemVariationData.name,
          `Square catalog variation ${id} name`,
        ),
        price: mapMoney(variation.itemVariationData.priceMoney),
      },
    ];
  });
}

function mapItem(
  item: CatalogObject.Item,
  itemIndex: number,
  locationId: string,
  indexes: RelatedObjectIndexes,
): { readonly category: ResolvedCategory; readonly item: CatalogItemDto } | null {
  if (!isCatalogObjectPresentAtLocation(item, locationId)) {
    return null;
  }

  const id = requireTrimmed(
    item.id,
    `Square catalog item at index ${itemIndex} ID`,
  );
  if (!item.itemData) {
    throw createCatalogContractError(`Square catalog item ${id} data is missing.`);
  }

  const variations = mapAvailableVariations(item, locationId);
  if (variations.length === 0) {
    return null;
  }

  const category = resolveCategory(item.itemData, indexes.categoriesById);

  return {
    category,
    item: {
      id,
      name: requireTrimmed(item.itemData.name, `Square catalog item ${id} name`),
      description:
        nullableTrimmed(item.itemData.descriptionPlaintext) ??
        nullableTrimmed(item.itemData.description),
      category: category.name,
      image_url: resolveImageUrl(item, indexes.imageUrlsById),
      variations,
    },
  };
}

/**
 * Purely maps a complete raw Square result into stable, JSON-safe category groups
 * for one location. Any malformed data needed by a published DTO fails atomically.
 */
export function mapCatalogForLocation(
  rawCatalog: RawCatalogResult,
  locationId: string,
): CatalogResponse {
  const normalizedLocationId = locationId.trim();
  if (!normalizedLocationId) {
    throw new RangeError("locationId must be a non-empty string.");
  }

  const indexes = indexRelatedObjects(rawCatalog.relatedObjects);
  const groupsByCategoryId = new Map<
    string,
    { category: ResolvedCategory; items: CatalogItemDto[] }
  >();

  rawCatalog.items.forEach((item, itemIndex) => {
    const mapped = mapItem(
      item,
      itemIndex,
      normalizedLocationId,
      indexes,
    );
    if (!mapped) {
      return;
    }

    const existingGroup = groupsByCategoryId.get(mapped.category.id);
    if (existingGroup) {
      existingGroup.items.push(mapped.item);
      return;
    }

    groupsByCategoryId.set(mapped.category.id, {
      category: mapped.category,
      items: [mapped.item],
    });
  });

  const categories: CatalogCategoryGroupDto[] = [
    ...groupsByCategoryId.values(),
  ].map(({ category, items }) => ({ ...category, items }));

  return { categories };
}
