import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LocationDto } from "@/types/locations";

import { HoursPill } from "./hours-pill";

function location(
  overrides: Partial<LocationDto> = {},
): LocationDto {
  return {
    id: "LOCATION1",
    name: "Downtown Cafe",
    address: null,
    timezone: "UTC",
    businessHours: [
      { dayOfWeek: "MON", startLocalTime: "09:00", endLocalTime: "21:00" },
    ],
    status: "ACTIVE",
    ...overrides,
  };
}

// 2026-01-05 is a Monday; times below are UTC to match the fixture timezone.
const MONDAY_3PM = new Date("2026-01-05T15:00:00Z");
const MONDAY_8AM = new Date("2026-01-05T08:00:00Z");
const MONDAY_10PM = new Date("2026-01-05T22:00:00Z");

afterEach(cleanup);

describe("HoursPill", () => {
  it("shows an open pill with the closing time", () => {
    render(<HoursPill location={location()} now={MONDAY_3PM} status="ready" />);

    const pill = screen.getByText("Open now · Closes 9:00 PM");
    expect(pill).toBeInTheDocument();
    expect(pill.closest(".hours-pill")).toHaveClass("hours-pill--open");
  });

  it("shows a closed pill without a day label when it reopens later today", () => {
    render(<HoursPill location={location()} now={MONDAY_8AM} status="ready" />);

    const pill = screen.getByText("Closed · Opens 9:00 AM");
    expect(pill).toBeInTheDocument();
    expect(pill.closest(".hours-pill")).toHaveClass("hours-pill--closed");
  });

  it("shows a closed pill with a short day label when it reopens another day", () => {
    render(
      <HoursPill
        location={location({
          businessHours: [
            { dayOfWeek: "TUE", startLocalTime: "09:00", endLocalTime: "17:00" },
          ],
        })}
        now={MONDAY_10PM}
        status="ready"
      />,
    );

    expect(
      screen.getByText("Closed · Opens Tue 9:00 AM"),
    ).toBeInTheDocument();
  });

  it("renders nothing when hours are unknown", () => {
    const { container } = render(
      <HoursPill
        announce
        location={location({ businessHours: null })}
        now={MONDAY_3PM}
        status="ready"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector(".hours-pill")).toBeNull();
  });

  it("renders nothing while locations are not ready", () => {
    const { container } = render(<HoursPill status="loading" />);

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector(".hours-pill")).toBeNull();
  });
});
