import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAVORITES_STORAGE_KEY, useFavorites } from "./use-favorites";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFavorites", () => {
  it("reads the initial favorites from localStorage", () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(["ITEM1", "ITEM2"]),
    );

    const { result } = renderHook(() => useFavorites());

    expect(result.current.isFavorite("ITEM1")).toBe(true);
    expect(result.current.isFavorite("ITEM2")).toBe(true);
    expect(result.current.isFavorite("ITEM3")).toBe(false);
  });

  it("toggling persists the change to localStorage", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite("ITEM1")).toBe(false);

    act(() => result.current.toggleFavorite("ITEM1"));
    expect(result.current.isFavorite("ITEM1")).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]"),
    ).toEqual(["ITEM1"]);

    act(() => result.current.toggleFavorite("ITEM1"));
    expect(result.current.isFavorite("ITEM1")).toBe(false);
    expect(
      JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]"),
    ).toEqual([]);
  });

  it("tolerates corrupt JSON by starting from an empty set", () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "{not valid json");

    const { result } = renderHook(() => useFavorites());

    expect(result.current.favoriteIds.size).toBe(0);
    expect(() => act(() => result.current.toggleFavorite("ITEM1"))).not.toThrow();
    expect(result.current.isFavorite("ITEM1")).toBe(true);
  });

  it("survives a storage environment that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage);

    const { result } = renderHook(() => useFavorites());
    expect(result.current.favoriteIds.size).toBe(0);

    expect(() => act(() => result.current.toggleFavorite("ITEM1"))).not.toThrow();
    // The session-local write cannot round-trip through throwing storage.
    expect(result.current.isFavorite("ITEM1")).toBe(false);
  });

  it("syncs when another tab writes through a storage event", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite("ITEM9")).toBe(false);

    act(() => {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(["ITEM9"]),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: FAVORITES_STORAGE_KEY }),
      );
    });

    expect(result.current.isFavorite("ITEM9")).toBe(true);
  });
});
