import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MenuItemCard } from "./menu-item-card";

const item = {
  id: "ITEM1",
  name: "Cafe Latte",
  description: "A complete description remains available to screen readers.",
  category: "Coffee",
  image_url: "https://example.invalid/latte.jpg",
  variations: [
    { id: "SMALL", name: "Small", price: { amount: "325", currency: "USD" } },
    { id: "LARGE", name: "Large", price: null },
  ],
} as const;

const longDescription =
  "This deliberately long cafe description explains the beans, roast, milk, texture, aroma, serving style, and tasting notes in enough detail to require the explicit disclosure control.";

function mockDescriptionBox(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    scrollHeight,
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    clientHeight,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("MenuItemCard", () => {
  it("keeps all variation and description content in the accessible tree", () => {
    render(<MenuItemCard item={item} />);

    expect(screen.getByRole("heading", { name: "Cafe Latte" })).toBeInTheDocument();
    expect(screen.getByText(item.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read more" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Variations for Cafe Latte" })).toHaveTextContent("Small$3.25LargePrice unavailable");
  });

  it("drops the variation list for a lone variation but keeps its price", () => {
    const single = {
      ...item,
      variations: [
        { id: "ONLY", name: "Regular", price: { amount: "450", currency: "USD" } },
      ],
    };
    render(<MenuItemCard item={single} />);

    // One variation is not a choice, so the list would just repeat the price.
    expect(
      screen.queryByRole("list", { name: "Variations for Cafe Latte" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Regular")).not.toBeInTheDocument();
    // The exact price still shows, with no "From" floor prefix.
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(screen.queryByText(/From/)).not.toBeInTheDocument();
  });

  it("expands and collapses only a long description with a stable relationship", () => {
    mockDescriptionBox(48, 32);
    render(
      <MenuItemCard item={{ ...item, description: longDescription }} />,
    );
    const description = screen.getByText(longDescription);
    const toggle = screen.getByRole("button", { name: "Read more" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", description.id);
    expect(description).not.toHaveClass("is-expanded");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(description).toHaveClass("is-expanded");

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: "Read more" })).toHaveAttribute(
      "aria-controls",
      description.id,
    );
  });

  it("uses actual visual overflow for concise text and remeasures on resize", () => {
    const conciseDescription =
      "Concise copy can still wrap beyond two lines inside a narrow menu card.";
    let scrollHeight = 48;
    let clientHeight = 32;
    let resizeCallback: ResizeObserverCallback | undefined;

    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      () => scrollHeight,
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      () => clientHeight,
    );
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    render(
      <MenuItemCard item={{ ...item, description: conciseDescription }} />,
    );
    expect(conciseDescription.length).toBeLessThanOrEqual(120);
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();

    scrollHeight = 32;
    clientHeight = 32;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(screen.queryByRole("button", { name: "Read more" })).not.toBeInTheDocument();

    scrollHeight = 48;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();
  });

  it("does not disclose short text when its collapsed box does not overflow", () => {
    mockDescriptionBox(32, 32);
    render(<MenuItemCard item={item} />);
    expect(screen.queryByRole("button", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("does not render a disclosure control for a missing description", () => {
    render(<MenuItemCard item={{ ...item, description: null }} />);
    expect(screen.getByText("No description available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Read more" })).not.toBeInTheDocument();
  });

  it("renders an unpressed favorite toggle labelled for adding", () => {
    render(<MenuItemCard item={item} />);

    const toggle = screen.getByRole("button", {
      name: "Add Cafe Latte to favorites",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles favorite state and relabels the control on click", () => {
    render(<MenuItemCard item={item} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add Cafe Latte to favorites" }),
    );
    const pressed = screen.getByRole("button", {
      name: "Remove Cafe Latte from favorites",
    });
    expect(pressed).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pressed);
    expect(
      screen.getByRole("button", { name: "Add Cafe Latte to favorites" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects a favorite already stored in localStorage", () => {
    window.localStorage.setItem(
      "menu-explorer-favorites",
      JSON.stringify(["ITEM1"]),
    );
    render(<MenuItemCard item={item} />);

    expect(
      screen.getByRole("button", { name: "Remove Cafe Latte from favorites" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders no decorative add element and exactly one favorite button", () => {
    const { container } = render(<MenuItemCard item={item} />);

    expect(container.querySelector(".menu-card__add")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Cafe Latte to favorites/ }),
    ).toHaveLength(1);
  });

  it("replaces a failed remote image with the labelled local fallback", () => {
    const { container } = render(<MenuItemCard item={item} />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();

    fireEvent.error(image!);

    expect(
      screen.getByRole("img", { name: "No image available for Cafe Latte" }),
    ).toBeInTheDocument();
  });
});
