"use client";

import { useCallback, useSyncExternalStore } from "react";

import { getBrowserStorage } from "@/lib/client/safe-storage";

export const FAVORITES_STORAGE_KEY = "menu-explorer-favorites";

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();

// Cache the parsed set keyed on the raw stored string so getSnapshot stays
// referentially stable between renders yet still reflects external writes
// (a second tab, or a test calling localStorage directly).
let cachedRaw: string | null = null;
let cachedIds: ReadonlySet<string> = EMPTY_FAVORITES;
let cacheInitialized = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function readRaw(): string | null {
  try {
    return getBrowserStorage()?.getItem(FAVORITES_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function parseIds(raw: string | null): ReadonlySet<string> {
  if (raw === null) {
    return EMPTY_FAVORITES;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY_FAVORITES;
    }
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return EMPTY_FAVORITES;
  }
}

function persist(ids: ReadonlySet<string>): void {
  try {
    getBrowserStorage()?.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // Favorites still apply for this session when storage is unavailable.
  }
}

function getSnapshot(): ReadonlySet<string> {
  const raw = readRaw();
  if (!cacheInitialized || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parseIds(raw);
    cacheInitialized = true;
  }
  return cachedIds;
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY_FAVORITES;
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.key !== null && event.key !== FAVORITES_STORAGE_KEY) {
    return;
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorageEvent);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

function toggle(id: string): void {
  const next = new Set(getSnapshot());
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  persist(next);
  emit();
}

export interface UseFavoritesResult {
  readonly favoriteIds: ReadonlySet<string>;
  readonly isFavorite: (id: string) => boolean;
  readonly toggleFavorite: (id: string) => void;
}

export function useFavorites(): UseFavoritesResult {
  const favoriteIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );
  const toggleFavorite = useCallback((id: string) => toggle(id), []);

  return { favoriteIds, isFavorite, toggleFavorite };
}
