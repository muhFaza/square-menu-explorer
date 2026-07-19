export interface CatalogMoneyDto {
  /** Base-10 minor-unit integer. A string preserves Square's bigint exactly. */
  readonly amount: string;
  readonly currency: string;
}

export interface CatalogVariationDto {
  readonly id: string;
  readonly name: string;
  readonly price: CatalogMoneyDto | null;
}

export interface CatalogItemDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string;
  readonly image_url: string | null;
  readonly variations: readonly CatalogVariationDto[];
}

export interface CatalogCategoryGroupDto {
  readonly id: string;
  readonly name: string;
  readonly items: readonly CatalogItemDto[];
}

export interface CatalogResponse {
  readonly categories: readonly CatalogCategoryGroupDto[];
}

export interface CatalogCategorySummaryDto {
  readonly id: string;
  readonly name: string;
  readonly item_count: number;
}

export interface CatalogCategoriesResponse {
  readonly categories: readonly CatalogCategorySummaryDto[];
}
