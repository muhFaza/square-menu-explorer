"use client";

import { useEffect, useState } from "react";

import type { LocationSelectionStatus } from "@/hooks/use-location-selection";
import { getOpenStatus } from "@/lib/client/open-status";
import type { LocationDto } from "@/types/locations";

interface HoursPillProps {
  readonly announce?: boolean;
  readonly location?: LocationDto;
  readonly status: LocationSelectionStatus;
  /** Fixed clock for deterministic tests; omit in production for a live pill. */
  readonly now?: Date;
}

export function HoursPill({
  announce = false,
  location,
  now,
  status,
}: HoursPillProps) {
  // Re-render each minute so a live pill flips open/closed without a reload.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (now) {
      return;
    }
    const interval = setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => clearInterval(interval);
  }, [now]);

  const openStatus =
    status === "ready" && location
      ? getOpenStatus(location, now)
      : { kind: "unknown" as const };

  // Nothing to show until Square confirms real open/closed hours for a location.
  if (openStatus.kind === "unknown") {
    return null;
  }

  const isOpen = openStatus.kind === "open";
  const detail = isOpen
    ? `Closes ${openStatus.closesAtLabel}`
    : openStatus.opensAtLabel === null
      ? null
      : `Opens ${openStatus.opensDayLabel ? `${openStatus.opensDayLabel} ` : ""}${openStatus.opensAtLabel}`;
  const label = isOpen ? "Open now" : "Closed";
  const text = detail ? `${label} · ${detail}` : label;

  return (
    <div
      aria-label={`Store hours: ${text}`}
      aria-live={announce ? "polite" : undefined}
      className={`hours-pill hours-pill--${isOpen ? "open" : "closed"}`}
      role={announce ? "status" : undefined}
    >
      <span aria-hidden="true" className="hours-pill__dot" />
      <span className="hours-pill__text">{text}</span>
    </div>
  );
}
