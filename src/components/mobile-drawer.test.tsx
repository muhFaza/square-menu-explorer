import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileDrawer } from "./mobile-drawer";

function renderDrawer(props: Partial<ComponentProps<typeof MobileDrawer>> = {}) {
  return render(
    <MobileDrawer
      aboutActive={false}
      favoritesActive={false}
      favoritesCount={0}
      onClose={vi.fn()}
      onSelectAbout={vi.fn()}
      onSelectFavorites={vi.fn()}
      {...props}
    >
      <nav aria-label="Menu categories">
        <button type="button">All items</button>
      </nav>
    </MobileDrawer>,
  );
}

afterEach(cleanup);

describe("MobileDrawer", () => {
  it("is a modal dialog that moves focus inside and locks body scroll", () => {
    renderDrawer();

    const dialog = screen.getByRole("dialog", { name: "Menu navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores focus to the opener and unlocks scroll when it closes", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(opener).toHaveFocus();

    const { unmount } = renderDrawer();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    opener.remove();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the scrim is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderDrawer({ onClose });

    const scrim = container.querySelector(".mobile-drawer__scrim");
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("plays a closing animation and only unmounts once it ends", () => {
    const onClosed = vi.fn();
    const { container } = renderDrawer({ closing: true, onClosed });

    expect(container.querySelector(".mobile-drawer")).toHaveClass("is-closing");
    const panel = container.querySelector(".mobile-drawer__panel");
    expect(panel).not.toBeNull();
    expect(onClosed).not.toHaveBeenCalled();

    fireEvent.animationEnd(panel as Element);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("closes instantly, without waiting for the animation, under reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia,
    );
    const onClosed = vi.fn();

    renderDrawer({ closing: true, onClosed });
    expect(onClosed).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("unmounts via a timeout fallback when animationend never fires", () => {
    vi.useFakeTimers();
    const onClosed = vi.fn();

    renderDrawer({ closing: true, onClosed });
    expect(onClosed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(onClosed).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("offers a working About entry and no Menu or Orders entry", () => {
    const onSelectAbout = vi.fn();
    const { rerender } = renderDrawer({ onSelectAbout });

    const about = screen.getByRole("button", { name: "About" });
    expect(about).not.toHaveAttribute("aria-disabled");
    expect(about).not.toHaveAttribute("aria-current");
    fireEvent.click(about);
    expect(onSelectAbout).toHaveBeenCalledTimes(1);

    // The desktop sidebar has no Menu entry; the category list already returns
    // you to the menu, so the drawer must not carry a redundant one.
    expect(
      screen.queryByRole("button", { name: "Menu" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();

    rerender(
      <MobileDrawer
        aboutActive
        favoritesActive={false}
        favoritesCount={0}
        onClose={vi.fn()}
        onSelectAbout={onSelectAbout}
        onSelectFavorites={vi.fn()}
      >
        <nav aria-label="Menu categories" />
      </MobileDrawer>,
    );
    expect(screen.getByRole("button", { name: "About" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows a real favorites entry with a count and marks it current when active", () => {
    const onSelectFavorites = vi.fn();
    const { rerender } = renderDrawer({ favoritesCount: 3, onSelectFavorites });

    const favorites = screen.getByRole("button", { name: /Favorites/ });
    expect(favorites).toHaveTextContent("3");
    expect(favorites).not.toHaveAttribute("aria-current");
    fireEvent.click(favorites);
    expect(onSelectFavorites).toHaveBeenCalledTimes(1);

    rerender(
      <MobileDrawer
        aboutActive={false}
        favoritesActive
        favoritesCount={3}
        onClose={vi.fn()}
        onSelectAbout={vi.fn()}
        onSelectFavorites={onSelectFavorites}
      >
        <nav aria-label="Menu categories" />
      </MobileDrawer>,
    );
    expect(
      screen.getByRole("button", { name: /Favorites/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("renders the provided category navigation", () => {
    renderDrawer();

    expect(
      screen.getByRole("navigation", { name: "Menu categories" }),
    ).toBeInTheDocument();
  });
});
