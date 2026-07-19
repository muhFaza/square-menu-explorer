import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchBar } from "./search-bar";

afterEach(cleanup);

describe("SearchBar", () => {
  it("is a labelled search input that reports every keystroke", () => {
    const onChange = vi.fn();
    render(<SearchBar onChange={onChange} value="" />);

    const input = screen.getByRole("searchbox", { name: "Search menu items" });
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute(
      "placeholder",
      "Search menu items, ingredients...",
    );

    fireEvent.change(input, { target: { value: "latte" } });
    expect(onChange).toHaveBeenCalledWith("latte");
  });

  it("shows a clear button only when there is text and clears on click", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBar onChange={onChange} value="" />);

    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();

    rerender(<SearchBar onChange={onChange} value="tea" />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("clears the query on Escape only while it holds text", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBar onChange={onChange} value="tea" />);

    const input = screen.getByRole("searchbox", { name: "Search menu items" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith("");

    onChange.mockClear();
    rerender(<SearchBar onChange={onChange} value="" />);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the input and hides the clear affordance when idle", () => {
    render(<SearchBar disabled onChange={vi.fn()} value="" />);

    expect(
      screen.getByRole("searchbox", { name: "Search menu items" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });
});
