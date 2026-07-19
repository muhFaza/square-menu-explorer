"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

import { CheckIcon, ChevronDownIcon, PinIcon } from "@/components/icons";
import type { LocationDto } from "@/types/locations";

export interface LocationSelectorProps {
  readonly disabled?: boolean;
  readonly locations: readonly LocationDto[];
  readonly onChange: (locationId: string) => void;
  readonly selectRef?: Ref<HTMLButtonElement>;
  readonly selectedLocationId: string | null;
}

export function LocationSelector({
  disabled = false,
  locations,
  onChange,
  selectRef,
  selectedLocationId,
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selectedIndex = locations.findIndex(
    (location) => location.id === selectedLocationId,
  );
  const selectedLocation = selectedIndex >= 0 ? locations[selectedIndex] : null;
  const triggerLabel = selectedLocation?.name ?? "Choose a location";
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  // Attach the trigger to our own ref (for focus return) and forward it to the
  // parent focus-recovery ref. Callers must pass a callback ref (the shell does).
  const setTriggerRef = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof selectRef === "function") {
      selectRef(node);
    }
  };

  useEffect(() => {
    if (open) {
      listRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const openListbox = (initialIndex: number) => {
    if (disabled || locations.length === 0) {
      return;
    }
    setActiveIndex(initialIndex);
    setOpen(true);
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectOption = (index: number) => {
    const location = locations[index];
    if (location) {
      onChange(location.id);
    }
    closeAndFocusTrigger();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "Enter":
      case " ":
      case "ArrowDown":
        event.preventDefault();
        openListbox(selectedIndex >= 0 ? selectedIndex : 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        openListbox(selectedIndex >= 0 ? selectedIndex : locations.length - 1);
        break;
      default:
        break;
    }
  };

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
    } else {
      openListbox(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, locations.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(locations.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        closeAndFocusTrigger();
        break;
      case "Tab":
        closeAndFocusTrigger();
        break;
      default:
        break;
    }
  };

  return (
    <div className="location-control" ref={containerRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Restaurant location"
        className="location-control__trigger"
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        ref={setTriggerRef}
        type="button"
      >
        <span aria-hidden="true" className="location-control__pin">
          <PinIcon size={16} />
        </span>
        <span className="location-control__value">{triggerLabel}</span>
        <span aria-hidden="true" className="location-control__chevron">
          <ChevronDownIcon size={16} />
        </span>
      </button>
      {open ? (
        <ul
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          aria-label="Restaurant location"
          className="location-control__listbox"
          id={listboxId}
          onKeyDown={handleListKeyDown}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
        >
          {locations.map((location, index) => {
            const isSelected = location.id === selectedLocationId;
            const isActive = index === activeIndex;
            return (
              <li
                aria-selected={isSelected}
                className={[
                  "location-control__option",
                  isActive ? "is-active" : "",
                  isSelected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                id={optionId(index)}
                key={location.id}
                onClick={() => selectOption(index)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                <span className="location-control__option-name">
                  {location.name}
                </span>
                <span aria-hidden="true" className="location-control__check">
                  {isSelected ? <CheckIcon size={16} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
