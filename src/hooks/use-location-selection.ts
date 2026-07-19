"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchLocations } from "@/lib/client/locations-api";
import type { LocationDto } from "@/types/locations";

export const SELECTED_LOCATION_STORAGE_KEY =
  "square-menu-explorer:selected-location:v1";

export type LocationSelectionStatus =
  | "loading"
  | "ready"
  | "error"
  | "empty";

export interface LocationSelectionState {
  readonly locations: readonly LocationDto[];
  readonly selectedLocationId: string | null;
  readonly status: LocationSelectionStatus;
}

const initialState: LocationSelectionState = {
  locations: [],
  selectedLocationId: null,
  status: "loading",
};

function getBrowserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readStoredLocationId(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(SELECTED_LOCATION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistLocationId(
  storage: Storage | undefined,
  locationId: string | null,
): void {
  try {
    if (locationId === null) {
      storage?.removeItem(SELECTED_LOCATION_STORAGE_KEY);
    } else {
      storage?.setItem(SELECTED_LOCATION_STORAGE_KEY, locationId);
    }
  } catch {
    // Selection still works for this session when storage is unavailable.
  }
}

export function resolveSelectedLocationId(
  locations: readonly LocationDto[],
  storedLocationId: string | null,
): string | null {
  if (locations.length === 0) {
    return null;
  }

  return locations.some(({ id }) => id === storedLocationId)
    ? storedLocationId
    : locations[0].id;
}

export interface UseLocationSelectionResult extends LocationSelectionState {
  readonly retry: () => void;
  readonly selectLocation: (locationId: string) => void;
}

export function useLocationSelection(): UseLocationSelectionResult {
  const [state, setState] = useState<LocationSelectionState>(initialState);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const storage = getBrowserStorage();

    void fetchLocations({ signal: controller.signal })
      .then((locations) => {
        if (locations.length === 0) {
          persistLocationId(storage, null);
          setState({
            locations,
            selectedLocationId: null,
            status: "empty",
          });
          return;
        }

        const selectedLocationId = resolveSelectedLocationId(
          locations,
          readStoredLocationId(storage),
        );
        persistLocationId(storage, selectedLocationId);
        setState({
          locations,
          selectedLocationId,
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          locations: [],
          selectedLocationId: null,
          status: "error",
        });
      });

    return () => controller.abort();
  }, [requestVersion]);

  const retry = useCallback(() => {
    setState(initialState);
    setRequestVersion((version) => version + 1);
  }, []);

  const selectLocation = useCallback((locationId: string) => {
    setState((current) => {
      if (
        current.status !== "ready" ||
        !current.locations.some(({ id }) => id === locationId)
      ) {
        return current;
      }

      persistLocationId(getBrowserStorage(), locationId);
      return { ...current, selectedLocationId: locationId };
    });
  }, []);

  return { ...state, retry, selectLocation };
}
