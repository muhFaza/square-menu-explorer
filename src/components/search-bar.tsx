"use client";

import { CloseIcon, SearchIcon } from "@/components/icons";

interface SearchBarProps {
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
  readonly value: string;
}

export function SearchBar({
  className = "search-bar",
  disabled = false,
  onChange,
  value,
}: SearchBarProps) {
  return (
    <div aria-disabled={disabled || undefined} className={className}>
      <SearchIcon size={17} />
      <input
        aria-label="Search menu items"
        className="search-bar__input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder="Search menu items, ingredients..."
        type="search"
        value={value}
      />
      {value !== "" ? (
        <button
          aria-label="Clear search"
          className="search-bar__clear"
          onClick={() => onChange("")}
          type="button"
        >
          <CloseIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}
