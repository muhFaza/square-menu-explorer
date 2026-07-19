"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";

import { MenuCatalogView } from "@/components/menu-catalog-view";
import {
  CategoryNavigationSkeleton,
  MenuLoadingSkeleton,
} from "@/components/menu-loading-skeleton";
import { SearchBar } from "@/components/search-bar";
import { TopBar } from "@/components/top-bar";
import { useLocationSelection } from "@/hooks/use-location-selection";
import { useMenuCatalog } from "@/hooks/use-menu-catalog";

function LocationStatePanel({
  emptyHeadingRef,
  retry,
  status,
}: {
  readonly emptyHeadingRef: Ref<HTMLHeadingElement>;
  readonly retry: () => void;
  readonly status: "loading" | "error" | "empty";
}) {
  if (status === "loading") {
    return (
      <section className="location-loading" aria-busy="true">
        <p className="sr-only" role="status" aria-live="polite">
          Loading restaurant locations.
        </p>
        <div className="location-loading__intro">
          <h1>Finding your locations</h1>
          <p>Connecting to the latest Square location list...</p>
        </div>
        <MenuLoadingSkeleton />
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="state-panel" role="alert">
        <span aria-hidden="true" className="state-panel__icon">
          !
        </span>
        <h1>Locations couldn&apos;t load</h1>
        <p>We couldn&apos;t load locations. Please try again.</p>
        <button className="primary-action" onClick={retry} type="button">
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="state-panel" role="status">
      <span aria-hidden="true" className="state-panel__icon">
        ⌖
      </span>
      <h1 ref={emptyHeadingRef} tabIndex={-1}>
        No active locations
      </h1>
      <p>There aren&apos;t any active Square locations to browse yet.</p>
    </section>
  );
}

export function MenuExplorerShell() {
  const {
    locations,
    retry,
    selectedLocationId,
    selectLocation,
    status,
  } = useLocationSelection();
  const menu = useMenuCatalog(
    status === "ready" ? selectedLocationId : null,
  );
  const selectedLocation = locations.find(
    ({ id }) => id === selectedLocationId,
  );
  const panelStatus = status === "ready" ? "loading" : status;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLocationId, setSearchLocationId] = useState(selectedLocationId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const locationSelectorRef = useRef<HTMLButtonElement>(null);
  const emptyLocationsHeadingRef = useRef<HTMLHeadingElement>(null);
  const recoveryFocusPending = useRef(false);

  // Filtering is scoped to a single location's menu, so a new location starts fresh.
  if (selectedLocationId !== searchLocationId) {
    setSearchLocationId(selectedLocationId);
    setSearchQuery("");
    setDrawerOpen(false);
  }

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const setLocationSelectorRef = useCallback(
    (node: HTMLButtonElement | null) => {
      locationSelectorRef.current = node;
    },
    [],
  );

  const retryLocations = useCallback(() => {
    recoveryFocusPending.current = true;
    retry();
  }, [retry]);

  useEffect(() => {
    if (
      recoveryFocusPending.current &&
      (status === "ready" || status === "empty")
    ) {
      recoveryFocusPending.current = false;
      if (status === "ready") {
        locationSelectorRef.current?.focus();
      } else {
        emptyLocationsHeadingRef.current?.focus();
      }
    }
  }, [status]);

  const searchDisabled = status !== "ready" || menu.status !== "ready";

  return (
    <main className="menu-page">
      <TopBar
        drawerOpen={drawerOpen}
        locations={locations}
        onOpenDrawer={openDrawer}
        onSearchChange={setSearchQuery}
        onSelectLocation={selectLocation}
        searchDisabled={searchDisabled}
        searchValue={searchQuery}
        selectRef={setLocationSelectorRef}
        selectedLocation={selectedLocation}
        selectedLocationId={selectedLocationId}
        status={status}
      />

      {status === "ready" && selectedLocation ? (
        <div className="workspace">
          <MenuCatalogView
            key={selectedLocation.id}
            drawerOpen={drawerOpen}
            locationName={selectedLocation.name}
            menu={menu}
            onClearSearch={() => setSearchQuery("")}
            onCloseDrawer={closeDrawer}
            onSearchChange={setSearchQuery}
            searchDisabled={searchDisabled}
            searchQuery={searchQuery}
          />
        </div>
      ) : (
        <div
          className={`workspace${
            panelStatus === "loading" ? "" : " workspace--single"
          }`}
        >
          {/* While locations load, mirror the ready layout's sidebar so the
              desktop grid doesn't pop in when the first menu arrives. */}
          {panelStatus === "loading" ? (
            <aside className="sidebar">
              <CategoryNavigationSkeleton />
            </aside>
          ) : null}
          <section className="content-panel">
            {/* Keep the sticky mobile search present across location states. */}
            <div className="mobile-sticky-stack">
              <div className="mobile-search">
                <SearchBar
                  className="search-bar search-bar--mobile"
                  disabled={searchDisabled}
                  onChange={setSearchQuery}
                  value={searchQuery}
                />
              </div>
            </div>
            <LocationStatePanel
              emptyHeadingRef={emptyLocationsHeadingRef}
              retry={retryLocations}
              status={panelStatus}
            />
          </section>
        </div>
      )}
    </main>
  );
}
