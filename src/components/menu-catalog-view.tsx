"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CategoryIcon } from "@/components/category-icon";
import {
  ALL_ITEMS_CATEGORY_ID,
  CategoryNavigation,
} from "@/components/category-navigation";
import { AboutView } from "@/components/about-view";
import { HeartIcon, InfoIcon } from "@/components/icons";
import {
  CategoryNavigationSkeleton,
  MenuLoadingSkeleton,
} from "@/components/menu-loading-skeleton";
import { MenuItemCard } from "@/components/menu-item-card";
import { MobileDrawer } from "@/components/mobile-drawer";
import { SearchBar } from "@/components/search-bar";
import { useFavorites } from "@/hooks/use-favorites";
import type { MenuCatalogState } from "@/hooks/use-menu-catalog";

type ViewMode = "menu" | "favorites" | "about";

/** Must match the `menu-exit` animation duration in globals.css. */
const VIEW_EXIT_MS = 120;

interface MenuCatalogViewProps {
  readonly drawerOpen?: boolean;
  readonly locationName: string;
  readonly menu: MenuCatalogState;
  readonly onClearSearch?: () => void;
  readonly onCloseDrawer?: () => void;
  readonly onSearchChange?: (value: string) => void;
  readonly searchDisabled?: boolean;
  readonly searchQuery?: string;
}

function MenuLoadingState({ locationName }: { readonly locationName: string }) {
  return (
    <section className="menu-loading" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite">
        Loading menu for {locationName}.
      </p>
      <MenuLoadingSkeleton />
    </section>
  );
}

export function MenuCatalogView({
  drawerOpen = false,
  locationName,
  menu,
  onClearSearch,
  onCloseDrawer,
  onSearchChange,
  searchDisabled = false,
  searchQuery = "",
}: MenuCatalogViewProps) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    ALL_ITEMS_CATEGORY_ID,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  // The view being switched to while the outgoing one animates out; null when
  // no switch is in flight. `viewMode` stays on the view that is still visible.
  const [pendingView, setPendingView] = useState<ViewMode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Keep the drawer mounted through its exit animation: it stays rendered until
  // MobileDrawer signals the close finished, then this drops it from the DOM.
  const [drawerMounted, setDrawerMounted] = useState(drawerOpen);
  const handleDrawerClosed = useCallback(() => setDrawerMounted(false), []);
  // Opening mounts immediately; closing keeps it mounted until onClosed fires.
  if (drawerOpen && !drawerMounted) {
    setDrawerMounted(true);
  }
  const { favoriteIds } = useFavorites();
  const isFavoritesMode = viewMode === "favorites";
  // Search announcements and scroll-spy only make sense over the real menu.
  const isMenuMode = viewMode === "menu";
  const contentRef = useRef<HTMLDivElement>(null);
  const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);
  const recoveryFocusPending = useRef(false);
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery !== "";

  // Case-insensitive substring match on name or description; grouping is kept and
  // categories with no surviving items drop out. Sidebar counts stay unfiltered.
  const filteredCategories = useMemo(() => {
    const source = menu.data?.catalog.categories ?? [];
    if (trimmedQuery === "") {
      return source;
    }
    const needle = trimmedQuery.toLowerCase();
    return source
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            (item.description?.toLowerCase().includes(needle) ?? false),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu.data, trimmedQuery]);

  const matchCount = filteredCategories.reduce(
    (total, category) => total + category.items.length,
    0,
  );
  const noResults = isSearching && filteredCategories.length === 0;

  // Favorites reuse the searched grouping, keeping only favorited items and the
  // categories that still hold one — so removals update the list live.
  const favoriteCategories = useMemo(
    () =>
      filteredCategories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => favoriteIds.has(item.id)),
        }))
        .filter((category) => category.items.length > 0),
    [filteredCategories, favoriteIds],
  );

  // Badge count ignores the search query: it reflects every favorited item
  // present in this location's loaded menu.
  const favoritesPresentCount = useMemo(() => {
    const source = menu.data?.catalog.categories ?? [];
    return source.reduce(
      (total, category) =>
        total + category.items.filter((item) => favoriteIds.has(item.id)).length,
      0,
    );
  }, [menu.data, favoriteIds]);
  const visibleCategorySignature = filteredCategories
    .map((category) => category.id)
    .join(",");
  // An explicit category choice must win over scroll-spy updates while the
  // programmatic scroll settles (and permanently on pages too short to scroll
  // the section to the top).
  const manualSelectionUntil = useRef(0);
  // A category chosen from Favorites can't scroll yet: the menu sections mount
  // only after the view flips, so we stash the target and scroll in a layout
  // effect once they exist.
  const pendingScrollCategoryRef = useRef<string | null>(null);
  const categories = menu.data?.categorySummaries.categories ?? [];

  // DOM-only scroll to a section (or the top for "All items"). A filtered-out
  // category id resolves to null and no-ops gracefully.
  const scrollToCategory = useCallback((categoryId: string) => {
    const target =
      categoryId === ALL_ITEMS_CATEGORY_ID
        ? contentRef.current
        : document.getElementById(`category-${categoryId}`);
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    manualSelectionUntil.current = Date.now() + (reduceMotion ? 200 : 1000);
    target?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  // The view the user is headed for, which is what the navigation should
  // highlight immediately even while the outgoing view is still animating.
  const targetView = pendingView ?? viewMode;

  const commitView = useCallback((next: ViewMode) => {
    setViewMode(next);
    setPendingView(null);
  }, []);

  // Start the outgoing animation instead of swapping content on the spot. Under
  // reduced motion the exit keyframes are disabled, so there is nothing to wait
  // for — swap immediately rather than sitting on a blank 120ms.
  const requestView = useCallback(
    (next: ViewMode) => {
      if (next === targetView) {
        return;
      }
      // Reversing mid-transition: the view being asked for is the one still on
      // screen, so drop the pending swap instead of animating out and back in.
      if (next === viewMode) {
        setPendingView(null);
        return;
      }
      const reduceMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      if (reduceMotion) {
        commitView(next);
        return;
      }
      setPendingView(next);
    },
    [commitView, targetView, viewMode],
  );

  // Commit on a timer rather than animationend: the durations are identical,
  // and a timer stays deterministic when animationend cannot fire at all (no
  // AnimationEvent under jsdom, throttled background tabs, interrupted runs).
  useEffect(() => {
    if (pendingView === null) {
      return;
    }
    const timer = window.setTimeout(
      () => commitView(pendingView),
      VIEW_EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [commitView, pendingView]);

  const selectCategory = useCallback(
    (categoryId: string) => {
      setActiveCategoryId(categoryId);
      if (targetView !== "menu") {
        // Choosing a category always returns to the full menu; defer the scroll
        // until those sections have mounted (see the flush effect below).
        pendingScrollCategoryRef.current = categoryId;
        requestView("menu");
        return;
      }
      scrollToCategory(categoryId);
    },
    [requestView, scrollToCategory, targetView],
  );

  // Flush a scroll that was deferred while Favorites was still on screen or
  // while the drawer was animating out. This must stay a passive effect: the
  // drawer releases its body-scroll lock in a passive cleanup, and restoring
  // that style resets the scroll offset — so scrolling any earlier gets undone.
  useEffect(() => {
    if (
      viewMode !== "menu" ||
      menu.status !== "ready" ||
      drawerMounted ||
      // A view swap still in flight means the menu sections are not on screen
      // yet; the commit re-runs this effect once they are.
      pendingView !== null
    ) {
      return;
    }
    const pending = pendingScrollCategoryRef.current;
    if (pending === null) {
      return;
    }
    pendingScrollCategoryRef.current = null;
    scrollToCategory(pending);
  }, [drawerMounted, menu.status, pendingView, scrollToCategory, viewMode]);

  const retryMenu = useCallback(() => {
    recoveryFocusPending.current = true;
    menu.retry();
  }, [menu]);

  useEffect(() => {
    if (
      recoveryFocusPending.current &&
      (menu.status === "ready" || menu.status === "empty")
    ) {
      recoveryFocusPending.current = false;
      recoveryHeadingRef.current?.focus();
    }
  }, [menu.status]);

  // Debounced so fast typing doesn't spam the polite live region with counts.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (menu.status !== "ready" || !isSearching || !isMenuMode) {
          setAnnouncement("");
          return;
        }
        setAnnouncement(
          matchCount === 0
            ? "No items match"
            : `${matchCount} item${matchCount === 1 ? " matches" : "s match"}`,
        );
      },
      isSearching ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [isMenuMode, isSearching, matchCount, menu.status, trimmedQuery]);

  useEffect(() => {
    // Scroll-spy must not fight the Favorites active state.
    if (menu.status !== "ready" || !isMenuMode) {
      return;
    }

    const sections = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>("[data-category-id]") ??
        [],
    );
    if (sections.length === 0) {
      return;
    }

    const Observer = window.IntersectionObserver;
    if (typeof Observer === "function") {
      const observer = new Observer(
        (entries) => {
          if (Date.now() < manualSelectionUntil.current) {
            return;
          }
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
          const categoryId = visible?.target.getAttribute("data-category-id");
          if (categoryId) {
            setActiveCategoryId(categoryId);
          }
        },
        { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.5] },
      );
      sections.forEach((section) => observer.observe(section));
      return () => observer.disconnect();
    }

    const updateActiveCategory = () => {
      if (Date.now() < manualSelectionUntil.current) {
        return;
      }
      const firstBelowTop = sections.find(
        (section) => section.getBoundingClientRect().bottom > 150,
      );
      setActiveCategoryId(
        firstBelowTop?.dataset.categoryId ?? ALL_ITEMS_CATEGORY_ID,
      );
    };
    window.addEventListener("scroll", updateActiveCategory, { passive: true });
    updateActiveCategory();
    return () => window.removeEventListener("scroll", updateActiveCategory);
    // Re-observe when search changes which sections are actually rendered.
  }, [isMenuMode, menu.status, visibleCategorySignature]);

  // No category is highlighted while browsing favorites.
  // No category is highlighted outside the menu, or Favorites/About would sit
  // active alongside a category at the same time.
  const navActiveCategoryId = targetView === "menu" ? activeCategoryId : "";
  // Applied to whichever view is on screen, so the outgoing one animates out.
  const viewTransitionClass = `menu-transition${
    pendingView === null ? "" : " is-leaving"
  }`;
  const navigation = (
    <CategoryNavigation
      activeCategoryId={navActiveCategoryId}
      categories={categories}
      onSelect={selectCategory}
    />
  );

  // Always defer: the drawer's body-scroll lock outlives this click by the
  // length of the exit animation, and releasing it resets any scroll started
  // in the meantime. The flush effect scrolls once the drawer is gone.
  const selectCategoryFromDrawer = useCallback(
    (categoryId: string) => {
      setActiveCategoryId(categoryId);
      requestView("menu");
      pendingScrollCategoryRef.current = categoryId;
      onCloseDrawer?.();
    },
    [onCloseDrawer, requestView],
  );

  // Favorites is a distinct view; open it at its own top rather than inheriting
  // wherever the menu was scrolled to.
  const showFavorites = useCallback(() => {
    pendingScrollCategoryRef.current = null;
    requestView("favorites");
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo?.({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [requestView]);
  const showMenu = useCallback(() => requestView("menu"), [requestView]);
  // About is its own destination; open it at the top like Favorites.
  const showAbout = useCallback(() => {
    pendingScrollCategoryRef.current = null;
    requestView("about");
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo?.({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [requestView]);
  const selectAboutFromDrawer = useCallback(() => {
    showAbout();
    onCloseDrawer?.();
  }, [onCloseDrawer, showAbout]);
  const selectFavoritesFromDrawer = useCallback(() => {
    showFavorites();
    onCloseDrawer?.();
  }, [onCloseDrawer, showFavorites]);

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar__nav-group">
          {menu.status === "loading" || menu.status === "idle" ? (
            <CategoryNavigationSkeleton />
          ) : (
            <>
              {navigation}
              {menu.status === "ready" ? (
                <div className="sidebar__favorites">
                  <button
                    aria-current={targetView === "favorites" ? "true" : undefined}
                    className={`favorites-nav${targetView === "favorites" ? " is-active" : ""}`}
                    onClick={showFavorites}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="favorites-nav__icon"
                    >
                      <HeartIcon size={18} />
                    </span>
                    <span className="favorites-nav__name">Favorites</span>
                    {favoritesPresentCount > 0 ? (
                      <span
                        aria-label={`${favoritesPresentCount} saved`}
                        className="favorites-nav__count"
                      >
                        {favoritesPresentCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    aria-current={targetView === "about" ? "true" : undefined}
                    className={`favorites-nav${targetView === "about" ? " is-active" : ""}`}
                    onClick={showAbout}
                    type="button"
                  >
                    <span aria-hidden="true" className="favorites-nav__icon">
                      <InfoIcon size={18} />
                    </span>
                    <span className="favorites-nav__name">About</span>
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="menu-context">
          <strong>{locationName}</strong>
          <span>Square menu</span>
        </div>
      </aside>
      <section className="content-panel">
        {/* Single sticky container: search row + chips row share one stuck
            element and an opaque veil so scrolling never jitters the pair. */}
        {/* Search and category chips act on the menu; About has neither. */}
        {viewMode === "about" ? null : (
        <div className="mobile-sticky-stack">
          <div className="mobile-search">
            <SearchBar
              className="search-bar search-bar--mobile"
              disabled={searchDisabled}
              onChange={onSearchChange ?? (() => undefined)}
              value={searchQuery}
            />
          </div>
          {categories.length > 0 ? (
            <div className="mobile-categories">{navigation}</div>
          ) : menu.status === "loading" || menu.status === "idle" ? (
            <div className="mobile-categories mobile-categories--loading">
              <CategoryNavigationSkeleton />
            </div>
          ) : null}
        </div>
        )}

        {menu.status === "loading" || menu.status === "idle" ? (
          <MenuLoadingState locationName={locationName} />
        ) : null}
        {menu.status === "error" ? (
          <section className="menu-state menu-transition" role="alert">
            <span aria-hidden="true" className="state-panel__icon">!</span>
            <h1>Menu couldn&apos;t load</h1>
            <p>We couldn&apos;t load this location&apos;s menu. Please try again.</p>
            <button className="primary-action" onClick={retryMenu} type="button">
              Retry menu
            </button>
          </section>
        ) : null}
        {menu.status === "empty" ? (
          <section className="menu-state menu-transition" role="status">
            <span aria-hidden="true" className="state-panel__icon">0</span>
            <h1 ref={recoveryHeadingRef} tabIndex={-1}>
              No menu items here yet
            </h1>
            <p>Square returned no available menu items for {locationName}.</p>
          </section>
        ) : null}
        {menu.status === "ready" && menu.data ? (
          <>
            <p aria-atomic="true" aria-live="polite" className="sr-only">
              {announcement}
            </p>
            {viewMode === "about" ? (
              <div
                className={`menu-catalog ${viewTransitionClass}`}
                key={viewMode}
              >
                <AboutView />
              </div>
            ) : isFavoritesMode ? (
              favoriteCategories.length === 0 ? (
                <section
                  className={`menu-state ${viewTransitionClass}`}
                  key={viewMode}
                  role="status"
                >
                  <span aria-hidden="true" className="state-panel__icon">
                    <HeartIcon size={26} />
                  </span>
                  <h1>No favorites yet</h1>
                  <p>
                    Tap the heart on any item to save it here for quick access.
                  </p>
                  <button
                    className="primary-action"
                    onClick={showMenu}
                    type="button"
                  >
                    Browse the menu
                  </button>
                </section>
              ) : (
                <div
                  className={`menu-catalog ${viewTransitionClass}`}
                  key={viewMode}
                >
                  <header className="menu-catalog__header">
                    <p className="eyebrow">Saved items</p>
                    <h1>My Favorites</h1>
                    <p>Your favorited items available at {locationName}.</p>
                  </header>
                  {favoriteCategories.map((category) => (
                    <section className="category-section" key={category.id}>
                      <header className="category-section__header">
                        <div className="category-section__title">
                          <span
                            aria-hidden="true"
                            className="category-section__icon"
                          >
                            <CategoryIcon name={category.name} size={20} />
                          </span>
                          <div>
                            <h2>{category.name}</h2>
                            <span className="category-section__count">
                              {category.items.length} items
                            </span>
                          </div>
                        </div>
                      </header>
                      <div className="menu-grid">
                        {category.items.map((item) => (
                          <MenuItemCard item={item} key={item.id} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )
            ) : noResults ? (
              <section
                className={`menu-state ${viewTransitionClass}`}
                key={viewMode}
                role="status"
              >
                <span aria-hidden="true" className="state-panel__icon">
                  ?
                </span>
                <h1>No items match your search</h1>
                <p>
                  Nothing matches &ldquo;{trimmedQuery}&rdquo;. Try a different
                  term.
                </p>
                <button
                  className="primary-action"
                  onClick={onClearSearch}
                  type="button"
                >
                  Clear search
                </button>
              </section>
            ) : (
              <div
                className={`menu-catalog ${viewTransitionClass}`}
                key={viewMode}
                ref={contentRef}
              >
                <p className="sr-only" role="status" aria-live="polite">
                  Menu loaded for {locationName}.
                </p>
                <header
                  className="menu-catalog__header"
                  data-category-id={ALL_ITEMS_CATEGORY_ID}
                >
                  <p className="eyebrow">Now browsing</p>
                  <h1 ref={recoveryHeadingRef} tabIndex={-1}>
                    {locationName}
                  </h1>
                  <p>Choose a category or browse every available menu item.</p>
                </header>
                {filteredCategories.map((category, sectionIndex) => (
                  <section
                    className="category-section"
                    data-category-id={category.id}
                    id={`category-${category.id}`}
                    key={category.id}
                  >
                    <header className="category-section__header">
                      <div className="category-section__title">
                        <span
                          aria-hidden="true"
                          className="category-section__icon"
                        >
                          <CategoryIcon name={category.name} size={20} />
                        </span>
                        <div>
                          <h2>{category.name}</h2>
                          <span className="category-section__count">
                            {category.items.length} items
                          </span>
                        </div>
                      </div>
                    </header>
                    <div className="menu-grid">
                      {category.items.map((item, itemIndex) => (
                        <MenuItemCard
                          item={item}
                          key={item.id}
                          // Only the first section's leading cards can be the
                          // LCP image; everything below the fold stays lazy.
                          priority={sectionIndex === 0 && itemIndex < 4}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
      {drawerMounted ? (
        <MobileDrawer
          closing={!drawerOpen}
          aboutActive={targetView === "about"}
          favoritesActive={targetView === "favorites"}
          onSelectAbout={selectAboutFromDrawer}
          favoritesCount={favoritesPresentCount}
          onClose={onCloseDrawer ?? (() => undefined)}
          onClosed={handleDrawerClosed}
          onSelectFavorites={selectFavoritesFromDrawer}
        >
          <CategoryNavigation
            activeCategoryId={navActiveCategoryId}
            categories={categories}
            onSelect={selectCategoryFromDrawer}
          />
        </MobileDrawer>
      ) : null}
    </>
  );
}
