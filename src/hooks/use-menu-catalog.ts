"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchCatalogForLocation,
  type CatalogViewData,
} from "@/lib/client/catalog-api";

export type MenuCatalogStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error";

interface StoredMenuCatalogState {
  readonly data: CatalogViewData | null;
  readonly locationId: string | null;
  readonly requestVersion: number;
  readonly status: "ready" | "empty" | "error";
}

export interface MenuCatalogState {
  readonly data: CatalogViewData | null;
  readonly retry: () => void;
  readonly status: MenuCatalogStatus;
}

export function useMenuCatalog(locationId: string | null): MenuCatalogState {
  const [storedState, setStoredState] = useState<StoredMenuCatalogState | null>(
    null,
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (locationId === null) {
      return;
    }

    const controller = new AbortController();
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;

    void fetchCatalogForLocation(locationId, { signal: controller.signal })
      .then((data) => {
        if (requestSequence.current !== sequence) {
          return;
        }
        setStoredState({
          data,
          locationId,
          requestVersion,
          status: data.catalog.categories.length === 0 ? "empty" : "ready",
        });
      })
      .catch((error: unknown) => {
        if (
          requestSequence.current !== sequence ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setStoredState({
          data: null,
          locationId,
          requestVersion,
          status: "error",
        });
        controller.abort();
      });

    return () => {
      controller.abort();
    };
  }, [locationId, requestVersion]);

  const retry = useCallback(() => {
    setStoredState(null);
    setRequestVersion((version) => version + 1);
  }, []);

  if (locationId === null) {
    return { data: null, retry, status: "idle" };
  }

  if (
    storedState === null ||
    storedState.locationId !== locationId ||
    storedState.requestVersion !== requestVersion
  ) {
    return { data: null, retry, status: "loading" };
  }

  return { data: storedState.data, retry, status: storedState.status };
}
