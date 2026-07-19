import type { Ref } from "react";

import { HoursPill } from "@/components/hours-pill";
import { CupIcon, MenuIcon } from "@/components/icons";
import { LocationSelector } from "@/components/location-selector";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { LocationSelectionStatus } from "@/hooks/use-location-selection";
import type { LocationDto } from "@/types/locations";

function Brand() {
  return (
    <div className="brand" aria-label="Menu Explorer">
      <span aria-hidden="true" className="brand__mark">
        <CupIcon size={20} />
      </span>
      <span className="brand__name">Menu Explorer</span>
    </div>
  );
}

interface TopBarProps {
  readonly drawerOpen: boolean;
  readonly locations: readonly LocationDto[];
  readonly onOpenDrawer: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onSelectLocation: (locationId: string) => void;
  readonly searchDisabled: boolean;
  readonly searchValue: string;
  readonly selectRef?: Ref<HTMLButtonElement>;
  readonly selectedLocation?: LocationDto;
  readonly selectedLocationId: string | null;
  readonly status: LocationSelectionStatus;
}

export function TopBar({
  drawerOpen,
  locations,
  onOpenDrawer,
  onSearchChange,
  onSelectLocation,
  searchDisabled,
  searchValue,
  selectRef,
  selectedLocation,
  selectedLocationId,
  status,
}: TopBarProps) {
  // The drawer mirrors the sidebar, so the hamburger only appears once a menu is up.
  const showMenuButton = status === "ready" && Boolean(selectedLocation);

  return (
    <header className="topbar">
      {/* Hamburger is first in source order so it sits left of the mobile bar. */}
      {showMenuButton ? (
        <button
          aria-controls="mobile-drawer"
          aria-expanded={drawerOpen}
          aria-label="Open menu"
          className="icon-button topbar__menu-button"
          onClick={onOpenDrawer}
          type="button"
        >
          <MenuIcon />
        </button>
      ) : null}
      <Brand />
      <LocationSelector
        disabled={status !== "ready"}
        locations={locations}
        onChange={onSelectLocation}
        selectRef={selectRef}
        selectedLocationId={selectedLocationId}
      />
      <SearchBar
        disabled={searchDisabled}
        onChange={onSearchChange}
        value={searchValue}
      />
      <HoursPill
        announce={status === "ready"}
        location={selectedLocation}
        status={status}
      />
      <ThemeToggle />
    </header>
  );
}
