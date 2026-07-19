import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("labels the pending action and flips the html theme on click", () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
