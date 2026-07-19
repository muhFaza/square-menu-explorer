"use client";

import { useCallback, useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "menu-explorer-theme";

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getBrowserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readStoredTheme(): Theme | null {
  try {
    const value = getBrowserStorage()?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
}

function persistTheme(theme: Theme): void {
  try {
    getBrowserStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for this session when storage is unavailable.
  }
}

// The inline head script has already applied the resolved theme to <html>; read
// it back, falling back to storage then the media query (e.g. under tests).
function getSnapshot(): Theme {
  if (document.documentElement.getAttribute("data-theme") === "dark") {
    return "dark";
  }
  return readStoredTheme() ?? (prefersDark() ? "dark" : "light");
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(listener: () => void): () => void {
  // Sync the DOM to the resolved theme, then opt in to transitions so the first
  // paint never animates.
  applyTheme(getSnapshot());
  document.documentElement.setAttribute("data-theme-transitions", "");
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface UseThemeResult {
  readonly theme: Theme;
  readonly toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    persistTheme(next);
    emit();
  }, []);

  return { theme, toggleTheme };
}
