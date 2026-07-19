import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocationDto } from "@/types/locations";

import { LocationSelector } from "./location-selector";

const locations: readonly LocationDto[] = [
  {
    id: "LOCATION1",
    name: "Downtown Cafe",
    address: null,
    timezone: "America/Los_Angeles",
    businessHours: null,
    status: "ACTIVE",
  },
  {
    id: "LOCATION2",
    name: "Riverside Cafe",
    address: null,
    timezone: null,
    businessHours: null,
    status: "ACTIVE",
  },
];

function renderSelector(
  overrides: Partial<Parameters<typeof LocationSelector>[0]> = {},
) {
  const onChange = vi.fn();
  render(
    <LocationSelector
      locations={locations}
      onChange={onChange}
      selectedLocationId="LOCATION1"
      {...overrides}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Restaurant location" });
  return { onChange, trigger };
}

afterEach(() => {
  cleanup();
});

describe("LocationSelector", () => {
  it("renders the selected location name and a closed listbox", () => {
    const { trigger } = renderSelector();

    expect(trigger).toHaveTextContent("Downtown Cafe");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows a placeholder when nothing is selected", () => {
    const { trigger } = renderSelector({ selectedLocationId: null });

    expect(trigger).toHaveTextContent("Choose a location");
  });

  it("opens on click and marks the current location as selected", () => {
    const { trigger } = renderSelector();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(
      screen.getByRole("option", { name: "Downtown Cafe" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("option", { name: "Riverside Cafe" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("opens on ArrowDown from the trigger", () => {
    const { trigger } = renderSelector();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("navigates with arrows and selects with Enter", () => {
    const { onChange, trigger } = renderSelector();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("LOCATION2");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without selecting and restores trigger focus", () => {
    const { onChange, trigger } = renderSelector();

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Escape" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("does not open when disabled", () => {
    const { trigger } = renderSelector({ disabled: true });

    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
