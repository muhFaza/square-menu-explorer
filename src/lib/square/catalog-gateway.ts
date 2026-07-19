import "server-only";

import type {
  CatalogObject,
  SearchCatalogObjectsRequest,
  SearchCatalogObjectsResponse,
} from "square";

import { ApplicationError } from "@/lib/errors/application-error";
import { getSquareClient } from "@/lib/square/client";
import {
  mapSquareResponseErrors,
  mapSquareUpstreamError,
} from "@/lib/square/square-error";

const DEFAULT_MAX_CATALOG_PAGES = 1_000;

export interface RawCatalogResult {
  readonly items: readonly CatalogObject.Item[];
  readonly relatedObjects: readonly CatalogObject[];
}

export interface SquareCatalogClient {
  readonly catalog: {
    search(
      request: SearchCatalogObjectsRequest,
    ): Promise<SearchCatalogObjectsResponse>;
  };
}

export type SquareCatalogClientFactory = () => SquareCatalogClient;

export interface SquareCatalogGateway {
  fetchCatalog(): Promise<RawCatalogResult>;
}

export interface CatalogPaginationOptions {
  readonly maxPages?: number;
}

function createCatalogContractError(message: string): ApplicationError {
  return new ApplicationError({
    code: "SQUARE_UNAVAILABLE",
    statusCode: 502,
    message,
    publicMessage: "Menu data is temporarily unavailable.",
  });
}

function requireValidCursor(cursor: unknown): string {
  if (
    typeof cursor !== "string" ||
    cursor.length === 0 ||
    cursor.trim() !== cursor
  ) {
    throw createCatalogContractError(
      "Square SearchCatalogObjects returned an invalid cursor.",
    );
  }

  return cursor;
}

function appendItemPageObjects(
  response: SearchCatalogObjectsResponse,
  items: CatalogObject.Item[],
  relatedObjectsById: Map<string, CatalogObject>,
): void {
  for (const object of response.objects ?? []) {
    if (object.type !== "ITEM") {
      throw createCatalogContractError(
        "Square SearchCatalogObjects returned a non-ITEM primary object.",
      );
    }

    items.push(object);
  }

  for (const relatedObject of response.relatedObjects ?? []) {
    const id = relatedObject.id?.trim();
    if (!id) {
      throw createCatalogContractError(
        "Square SearchCatalogObjects returned a related object without an ID.",
      );
    }

    if (!relatedObjectsById.has(id)) {
      relatedObjectsById.set(id, relatedObject);
    }
  }
}

/**
 * CATEGORY objects arrive as primary results of their own search rather than as
 * item related objects, so they are folded into the same related-object index
 * the mapper reads to resolve `item_data.categories[]` references.
 */
function appendCategoryPageObjects(
  response: SearchCatalogObjectsResponse,
  relatedObjectsById: Map<string, CatalogObject>,
): void {
  for (const object of response.objects ?? []) {
    if (object.type !== "CATEGORY") {
      throw createCatalogContractError(
        "Square SearchCatalogObjects returned a non-CATEGORY primary object.",
      );
    }

    const id = object.id?.trim();
    if (!id) {
      throw createCatalogContractError(
        "Square SearchCatalogObjects returned a category without an ID.",
      );
    }

    if (!relatedObjectsById.has(id)) {
      relatedObjectsById.set(id, object);
    }
  }
}

/**
 * Follows every pagination cursor for one object-type search, failing the whole
 * retrieval on any bad page. Each page is handed to the caller for collection.
 */
async function fetchAllPagesForType(
  client: SquareCatalogClient,
  objectType: "ITEM" | "CATEGORY",
  maxPages: number,
  onPage: (response: SearchCatalogObjectsResponse) => void,
): Promise<void> {
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const request: SearchCatalogObjectsRequest = {
      objectTypes: [objectType],
      ...(objectType === "ITEM" ? { includeRelatedObjects: true } : {}),
      ...(cursor ? { cursor } : {}),
    };

    let response: SearchCatalogObjectsResponse;
    try {
      response = await client.catalog.search(request);
    } catch (error) {
      throw mapSquareUpstreamError(error, "catalog");
    }

    if (response.errors && response.errors.length > 0) {
      throw mapSquareResponseErrors(response.errors, "catalog");
    }

    onPage(response);

    if (response.cursor === undefined) {
      return;
    }

    const nextCursor = requireValidCursor(response.cursor);
    if (seenCursors.has(nextCursor)) {
      throw createCatalogContractError(
        "Square SearchCatalogObjects returned a repeated cursor.",
      );
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw createCatalogContractError(
    `Square SearchCatalogObjects exceeded ${maxPages} pages.`,
  );
}

/**
 * Retrieves the complete raw ITEM search plus the CATEGORY objects those items
 * reference before returning any data. Pagination and relationship collection
 * stay inside the Square boundary for later mapping.
 */
export async function fetchAllCatalogPages(
  client: SquareCatalogClient,
  { maxPages = DEFAULT_MAX_CATALOG_PAGES }: CatalogPaginationOptions = {},
): Promise<RawCatalogResult> {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new RangeError("maxPages must be a positive safe integer.");
  }

  const items: CatalogObject.Item[] = [];
  const relatedObjectsById = new Map<string, CatalogObject>();

  await fetchAllPagesForType(client, "ITEM", maxPages, (response) => {
    appendItemPageObjects(response, items, relatedObjectsById);
  });

  await fetchAllPagesForType(client, "CATEGORY", maxPages, (response) => {
    appendCategoryPageObjects(response, relatedObjectsById);
  });

  return {
    items,
    relatedObjects: [...relatedObjectsById.values()],
  };
}

export function createSquareCatalogGateway(
  clientFactory: SquareCatalogClientFactory = getSquareClient,
  options: CatalogPaginationOptions = {},
): SquareCatalogGateway {
  return {
    fetchCatalog: () => fetchAllCatalogPages(clientFactory(), options),
  };
}
