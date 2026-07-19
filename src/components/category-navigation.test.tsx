import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALL_ITEMS_CATEGORY_ID,
  CategoryNavigation,
} from "./category-navigation";

const categories = [
  { id: "COFFEE", name: "Coffee", item_count: 2 },
  { id: "TEA", name: "Tea", item_count: 3 },
] as const;

afterEach(cleanup);

describe("CategoryNavigation", () => {
  it("uses one tab stop and supports arrow, Home, and End focus movement", () => {
    render(
      <CategoryNavigation
        activeCategoryId={ALL_ITEMS_CATEGORY_ID}
        categories={categories}
        onSelect={vi.fn()}
      />,
    );

    const allItems = screen.getByRole("button", { name: /All items.*5 items/ });
    const coffee = screen.getByRole("button", { name: /Coffee.*2 items/ });
    const tea = screen.getByRole("button", { name: /Tea.*3 items/ });

    expect(allItems).toHaveAttribute("tabindex", "0");
    expect(coffee).toHaveAttribute("tabindex", "-1");
    allItems.focus();

    fireEvent.keyDown(allItems, { key: "ArrowRight" });
    expect(coffee).toHaveFocus();
    expect(coffee).toHaveAttribute("tabindex", "0");
    expect(allItems).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(coffee, { key: "End" });
    expect(tea).toHaveFocus();
    fireEvent.keyDown(tea, { key: "ArrowDown" });
    expect(allItems).toHaveFocus();
    fireEvent.keyDown(allItems, { key: "End" });
    expect(tea).toHaveFocus();
    fireEvent.keyDown(tea, { key: "Home" });
    expect(allItems).toHaveFocus();
    fireEvent.keyDown(allItems, { key: "ArrowLeft" });
    expect(tea).toHaveFocus();
  });

  it("activates the focused category with the native button behavior", () => {
    const onSelect = vi.fn();
    render(
      <CategoryNavigation
        activeCategoryId={ALL_ITEMS_CATEGORY_ID}
        categories={categories}
        onSelect={onSelect}
      />,
    );

    const allItems = screen.getByRole("button", { name: /All items.*5 items/ });
    const coffee = screen.getByRole("button", { name: /Coffee.*2 items/ });
    allItems.focus();
    fireEvent.keyDown(allItems, { key: "ArrowRight" });
    fireEvent.click(coffee);

    expect(onSelect).toHaveBeenCalledWith("COFFEE");
  });
});
