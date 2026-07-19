import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MenuCatalogState } from "@/hooks/use-menu-catalog";

import { MenuCatalogView } from "./menu-catalog-view";

// Switching between the menu and favorites animates the outgoing view out
// before swapping content, so the swap lands one exit-duration later. Waiting
// past that duration is what makes the new view observable.
async function settleViewTransition() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160));
  });
}

const menu = {
  status: "ready",
  retry: vi.fn(),
  data: {
    categorySummaries: {
      categories: [{ id: "TEA", name: "Tea", item_count: 1 }],
    },
    catalog: {
      categories: [
        {
          id: "TEA",
          name: "Tea",
          items: [
            {
              id: "ITEM1",
              name: "Iced Tea",
              description: null,
              category: "Tea",
              image_url: null,
              variations: [
                {
                  id: "REGULAR",
                  name: "Regular",
                  price: { amount: "425", currency: "USD" },
                },
              ],
            },
          ],
        },
      ],
    },
  },
} satisfies MenuCatalogState;

const loadingMenu = {
  status: "loading",
  retry: vi.fn(),
  data: null,
} satisfies MenuCatalogState;

const emptyMenu = {
  status: "empty",
  retry: vi.fn(),
  data: {
    categorySummaries: { categories: [] },
    catalog: { categories: [] },
  },
} satisfies MenuCatalogState;

const variation = [
  { id: "REGULAR", name: "Regular", price: { amount: "425", currency: "USD" } },
];

const searchMenu = {
  status: "ready",
  retry: vi.fn(),
  data: {
    categorySummaries: {
      categories: [
        { id: "TEA", name: "Tea", item_count: 2 },
        { id: "PASTRY", name: "Pastry", item_count: 1 },
      ],
    },
    catalog: {
      categories: [
        {
          id: "TEA",
          name: "Tea",
          items: [
            {
              id: "ICED",
              name: "Iced Tea",
              description: "Citrus and cane sugar.",
              category: "Tea",
              image_url: null,
              variations: variation,
            },
            {
              id: "CHAI",
              name: "Spiced Chai",
              description: "Black tea with warming spices.",
              category: "Tea",
              image_url: null,
              variations: variation,
            },
          ],
        },
        {
          id: "PASTRY",
          name: "Pastry",
          items: [
            {
              id: "CROISSANT",
              name: "Almond Croissant",
              description: "Toasted almond filling.",
              category: "Pastry",
              image_url: null,
              variations: variation,
            },
          ],
        },
      ],
    },
  },
} satisfies MenuCatalogState;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("MenuCatalogView", () => {
  it("keeps useful geometry while loading and announces the ready state once", () => {
    const { container, rerender } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={loadingMenu} />,
    );

    expect(container.querySelector(".menu-loading-skeleton")).toBeInTheDocument();
    expect(container.querySelector(".category-skeleton")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading menu for Riverside Cafe.",
    );

    rerender(<MenuCatalogView locationName="Riverside Cafe" menu={menu} />);

    expect(container.querySelector(".menu-loading-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Riverside Cafe" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Menu loaded for Riverside Cafe.",
    );
  });

  it("retries a clean error and restores focus to the recovered menu heading", async () => {
    const retry = vi.fn();
    const errorMenu = {
      status: "error",
      retry,
      data: null,
    } satisfies MenuCatalogState;
    const { rerender } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={errorMenu} />,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry menu" }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<MenuCatalogView locationName="Riverside Cafe" menu={loadingMenu} />);
    rerender(<MenuCatalogView locationName="Riverside Cafe" menu={menu} />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Riverside Cafe" }),
      ).toHaveFocus(),
    );
  });

  it("announces an empty catalog once and restores focus after retry", async () => {
    const retry = vi.fn();
    const errorMenu = {
      status: "error",
      retry,
      data: null,
    } satisfies MenuCatalogState;
    const { rerender } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={errorMenu} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry menu" }));
    rerender(<MenuCatalogView locationName="Riverside Cafe" menu={emptyMenu} />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No menu items here yet",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "No menu items here yet" }),
      ).toHaveFocus(),
    );
  });

  it("uses instant category scrolling when reduced motion is requested", () => {
    const scrollIntoView = vi.fn();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia,
    );
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<MenuCatalogView locationName="Riverside Cafe" menu={menu} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Tea.*1 items/ })[0],
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("filters items by name or description and hides emptied categories", () => {
    const { rerender } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="" />,
    );

    // A description-only match keeps the item, and the whole Pastry group drops out.
    rerender(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="tea" />,
    );
    expect(screen.getByRole("heading", { name: "Iced Tea" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Spiced Chai" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Almond Croissant" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Pastry" }),
    ).not.toBeInTheDocument();
    // Sidebar/chip counts stay at the unfiltered totals.
    expect(
      screen.getAllByRole("button", { name: /Tea.*2 items/ }).length,
    ).toBeGreaterThan(0);

    rerender(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="croissant" />,
    );
    expect(
      screen.getByRole("heading", { name: "Almond Croissant" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Tea" }),
    ).not.toBeInTheDocument();
  });

  it("shows a non-error empty state with a working clear action", () => {
    const onClearSearch = vi.fn();
    render(
      <MenuCatalogView
        locationName="Riverside Cafe"
        menu={searchMenu}
        onClearSearch={onClearSearch}
        searchQuery="zzz"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No items match your search" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Scope to the empty state's action; the mobile search also has a clear button.
    const emptyState = screen
      .getByRole("heading", { name: "No items match your search" })
      .closest("section") as HTMLElement;
    fireEvent.click(
      within(emptyState).getByRole("button", { name: "Clear search" }),
    );
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it("announces the match count politely after a debounce", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="" />,
      );

      rerender(
        <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="tea" />,
      );
      expect(screen.queryByText("2 items match")).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText("2 items match")).toBeInTheDocument();

      rerender(
        <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} searchQuery="zzz" />,
      );
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByText("No items match")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a favorites entry whose count tracks favorited items present", () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    const favoritesNav = screen.getByRole("button", { name: /Favorites/ });
    // No badge until something is favorited.
    expect(favoritesNav).not.toHaveTextContent("1");

    fireEvent.click(
      screen.getByRole("button", { name: "Add Iced Tea to favorites" }),
    );
    expect(screen.getByRole("button", { name: /Favorites/ })).toHaveTextContent(
      "1",
    );
  });

  it("opens About from the desktop sidebar with working outbound links", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    const aboutNav = screen.getByRole("button", { name: "About" });
    fireEvent.click(aboutNav);
    await settleViewTransition();

    expect(
      screen.getByRole("heading", { level: 1, name: "Square Menu Explorer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Every outbound link opens in a new tab and is safe against tab-nabbing.
    const links: readonly (readonly [RegExp, string])[] = [
      [/^square-menu-explorer/, "https://github.com/muhFaza/square-menu-explorer"],
      [/^github\.com\/muhFaza/, "https://github.com/muhFaza"],
      [/^muhammadfaza\.com/, "http://muhammadfaza.com/"],
      [/^linkedin\.com\/in\/mfaza/, "https://www.linkedin.com/in/mfaza/"],
    ];
    for (const [name, href] of links) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      // The new-tab behaviour is announced, not just visual.
      expect(link).toHaveTextContent("opens in a new tab");
    }

    // Credits name both the challenge author and the API provider.
    const thanks = screen.getByRole("heading", { name: "Thanks" })
      .parentElement as HTMLElement;
    expect(within(thanks).getByText("Per Diem")).toBeInTheDocument();
    expect(within(thanks).getByText("Square")).toBeInTheDocument();
  });

  it("hides the mobile search and category chips on About", async () => {
    const { container } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />,
    );

    expect(container.querySelector(".mobile-sticky-stack")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "About" }));
    await settleViewTransition();

    // Neither control acts on About, so leaving them visible implies the menu
    // is still underneath.
    expect(
      container.querySelector(".mobile-sticky-stack"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".mobile-categories")).not.toBeInTheDocument();

    // They come back with the menu.
    fireEvent.click(screen.getAllByRole("button", { name: /Tea.*2 items/ })[0]);
    await settleViewTransition();
    expect(container.querySelector(".mobile-sticky-stack")).toBeInTheDocument();
  });

  it("leaves About for the menu when a category is chosen", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(screen.getByRole("button", { name: "About" }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { level: 1, name: "Square Menu Explorer" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Tea.*2 items/ })[0]);
    await settleViewTransition();

    expect(
      screen.getByRole("heading", { name: "Riverside Cafe" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Square Menu Explorer" }),
    ).not.toBeInTheDocument();
  });

  it("animates the outgoing view out before swapping to favorites", async () => {
    const { container } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));

    // Mid-transition: the menu is still on screen, marked as leaving, and the
    // destination is already highlighted so the click feels immediate.
    expect(
      container.querySelector(".menu-catalog.is-leaving"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Riverside Cafe" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No favorites yet" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Favorites/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await settleViewTransition();

    expect(container.querySelector(".is-leaving")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No favorites yet" }),
    ).toBeInTheDocument();
  });

  it("swaps views instantly when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia,
    );
    const { container } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));

    // The exit keyframes are disabled under reduced motion, so waiting on them
    // would strand the user on the old view.
    expect(container.querySelector(".is-leaving")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No favorites yet" }),
    ).toBeInTheDocument();
  });

  it("filters the favorites view to favorited items present at the location", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add Iced Tea to favorites" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();

    expect(
      screen.getByRole("heading", { name: "My Favorites" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Iced Tea" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Spiced Chai" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Almond Croissant" }),
    ).not.toBeInTheDocument();
  });

  it("scrolls to the chosen category when leaving the favorites view", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add Iced Tea to favorites" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "My Favorites" }),
    ).toBeInTheDocument();

    // The Tea section only mounts once the view flips back to the menu, so the
    // scroll must be deferred until then.
    fireEvent.click(screen.getAllByRole("button", { name: /Tea.*2 items/ })[0]);
    await settleViewTransition();

    expect(
      screen.getByRole("heading", { name: "Riverside Cafe" }),
    ).toBeInTheDocument();
    const teaSection = document.getElementById("category-TEA");
    expect(teaSection).not.toBeNull();
    expect(scrollIntoView.mock.instances).toContain(teaSection);
  });

  it("scrolls to the drawer-chosen category when leaving favorites", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const onCloseDrawer = vi.fn();
    const view = (drawerOpen: boolean) => (
      <MenuCatalogView
        drawerOpen={drawerOpen}
        locationName="Riverside Cafe"
        menu={searchMenu}
        onCloseDrawer={onCloseDrawer}
      />
    );
    const { rerender } = render(view(false));

    fireEvent.click(
      screen.getByRole("button", { name: "Add Iced Tea to favorites" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();

    // Open the drawer while browsing favorites, then pick a category from it.
    rerender(view(true));
    const drawer = screen.getByRole("dialog", { name: "Menu navigation" });
    fireEvent.click(within(drawer).getByRole("button", { name: /Tea.*2 items/ }));

    expect(onCloseDrawer).toHaveBeenCalled();
    // The scroll must NOT run yet: the drawer still holds the body-scroll lock,
    // and releasing it on unmount resets any scroll started before then.
    expect(scrollIntoView).not.toHaveBeenCalled();

    // Close the drawer and let its exit animation finish.
    rerender(view(false));
    act(() => {
      fireEvent.animationEnd(
        screen.getByRole("dialog", { name: "Menu navigation" }),
      );
    });

    expect(
      screen.queryByRole("dialog", { name: "Menu navigation" }),
    ).not.toBeInTheDocument();

    // Only after the view swap lands do the menu sections exist to scroll to.
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "Riverside Cafe" }),
    ).toBeInTheDocument();
    expect(scrollIntoView.mock.instances).toContain(
      document.getElementById("category-TEA"),
    );
  });

  it("removing the last favorite reveals an empty state that returns to the menu", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "No favorites yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Browse the menu" }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "Iced Tea" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My Favorites" }),
    ).not.toBeInTheDocument();
  });

  it("live-removes a favorite from the favorites view when unfavorited", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add Iced Tea to favorites" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "Iced Tea" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Iced Tea from favorites" }),
    );
    expect(
      screen.getByRole("heading", { name: "No favorites yet" }),
    ).toBeInTheDocument();
  });

  it("choosing a category exits the favorites view back to the menu", async () => {
    render(<MenuCatalogView locationName="Riverside Cafe" menu={searchMenu} />);

    fireEvent.click(screen.getByRole("button", { name: /Favorites/ }));
    await settleViewTransition();
    expect(
      screen.getByRole("heading", { name: "No favorites yet" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Tea.*2 items/ })[0],
    );
    await settleViewTransition();
    expect(
      screen.queryByRole("heading", { name: "No favorites yet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Iced Tea" }),
    ).toBeInTheDocument();
  });

  it("updates both responsive category controls from observer visibility", () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();

    class FakeIntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      disconnect = disconnect;
      observe = observe;
      takeRecords = () => [];
      unobserve = vi.fn();
    }

    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const { unmount } = render(
      <MenuCatalogView locationName="Riverside Cafe" menu={menu} />,
    );
    const teaSection = document.getElementById("category-TEA");
    expect(teaSection).not.toBeNull();
    expect(observe).toHaveBeenCalled();

    act(() => {
      observerCallback?.(
        [
          {
            intersectionRatio: 0.9,
            isIntersecting: true,
            target: teaSection!,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    for (const button of screen.getAllByRole("button", {
      name: /Tea.*1 items/,
    })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
