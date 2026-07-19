import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SELECTED_LOCATION_STORAGE_KEY } from "@/hooks/use-location-selection";
import type { LocationDto } from "@/types/locations";

import { MenuExplorerShell } from "./menu-explorer-shell";

const locations = [
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
] as const;

const catalog = {
  categories: [
    {
      id: "COFFEE",
      name: "Coffee",
      items: [
        {
          id: "LATTE",
          name: "Cafe Latte",
          description: "Espresso with steamed milk.",
          category: "Coffee",
          image_url: null,
          variations: [
            { id: "SMALL", name: "Small", price: { amount: "325", currency: "USD" } },
            { id: "LARGE", name: "Large", price: null },
          ],
        },
      ],
    },
  ],
} as const;

const categorySummaries = {
  categories: [{ id: "COFFEE", name: "Coffee", item_count: 1 }],
} as const;

function locationsResponse(
  items: readonly LocationDto[] = locations,
): Response {
  return Response.json({ locations: items });
}

function applicationResponse(input: RequestInfo | URL): Response {
  const url = String(input);
  if (url === "/api/locations") {
    return locationsResponse();
  }
  return Response.json(url.includes("/categories") ? categorySummaries : catalog);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MenuExplorerShell", () => {
  it("shows loading, chooses the first active location, and persists it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      applicationResponse(input),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuExplorerShell />);

    expect(
      screen.getByRole("heading", { name: "Finding your locations" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading restaurant locations.",
    );
    expect(document.querySelector(".menu-loading-skeleton")).toBeInTheDocument();
    const selector = await screen.findByRole("button", {
      name: "Restaurant location",
    });
    await waitFor(() => expect(selector).toHaveTextContent("Downtown Cafe"));
    expect(await screen.findByRole("heading", { name: "Downtown Cafe" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cafe Latte" })).toBeInTheDocument();
    expect(screen.getAllByText("$3.25").length).toBeGreaterThan(0);
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
    expect(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY)).toBe(
      "LOCATION1",
    );
  });

  it("restores a valid selection and persists an accessible selector change", async () => {
    window.localStorage.setItem(
      SELECTED_LOCATION_STORAGE_KEY,
      "LOCATION2",
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      applicationResponse(input),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuExplorerShell />);

    const selector = await screen.findByRole("button", {
      name: "Restaurant location",
    });
    await waitFor(() => expect(selector).toHaveTextContent("Riverside Cafe"));

    fireEvent.click(selector);
    fireEvent.click(screen.getByRole("option", { name: "Downtown Cafe" }));
    expect(selector).toHaveTextContent("Downtown Cafe");
    expect(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY)).toBe(
      "LOCATION1",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
  });

  it("replaces a stale stored ID with the first current active location", async () => {
    window.localStorage.setItem(
      SELECTED_LOCATION_STORAGE_KEY,
      "STALE_LOCATION",
    );
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => applicationResponse(input)));

    render(<MenuExplorerShell />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Restaurant location" }),
      ).toHaveTextContent("Downtown Cafe"),
    );
    expect(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY)).toBe(
      "LOCATION1",
    );
  });

  it("keeps selection usable when browser storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => applicationResponse(input)));

    render(<MenuExplorerShell />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Restaurant location" }),
      ).toHaveTextContent("Downtown Cafe"),
    );
  });

  it("clears stale persistence and renders an empty state for no active locations", async () => {
    window.localStorage.setItem(
      SELECTED_LOCATION_STORAGE_KEY,
      "STALE_LOCATION",
    );
    vi.stubGlobal("fetch", vi.fn(async () => locationsResponse([])));

    render(<MenuExplorerShell />);

    const emptyHeading = await screen.findByRole("heading", {
      name: "No active locations",
    });
    expect(emptyHeading).toBeInTheDocument();
    expect(emptyHeading).not.toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("No active locations");
    expect(window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY)).toBeNull();
  });

  it("shows a retryable error and recovers on the next request", async () => {
    let locationsRequestCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/locations") {
        locationsRequestCount += 1;
        return locationsRequestCount === 1
          ? new Response(null, { status: 503 })
          : locationsResponse();
      }
      return applicationResponse(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuExplorerShell />);

    expect(
      await screen.findByRole("heading", { name: "Locations couldn't load" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Locations couldn't load",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Downtown Cafe" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Restaurant location" }),
      ).toHaveFocus(),
    );
    expect(locationsRequestCount).toBe(2);
  });

  it("moves focus to the empty heading when a locations retry returns no active locations", async () => {
    let locationsRequestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) !== "/api/locations") {
          return applicationResponse(input);
        }
        locationsRequestCount += 1;
        return locationsRequestCount === 1
          ? new Response(null, { status: 503 })
          : locationsResponse([]);
      }),
    );

    render(<MenuExplorerShell />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    const emptyHeading = await screen.findByRole("heading", {
      name: "No active locations",
    });

    await waitFor(() => expect(emptyHeading).toHaveFocus());
    expect(emptyHeading).toHaveAttribute("tabindex", "-1");
    expect(locationsRequestCount).toBe(2);
  });

  it("filters the ready menu from the top bar and resets on a location change", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      applicationResponse(input),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuExplorerShell />);

    expect(
      await screen.findByRole("heading", { name: "Cafe Latte" }),
    ).toBeInTheDocument();

    const [search] = screen.getAllByRole("searchbox", {
      name: "Search menu items",
    });
    expect(search).toBeEnabled();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(
      await screen.findByRole("heading", { name: "No items match your search" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cafe Latte" }),
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "latte" } });
    expect(screen.getByRole("heading", { name: "Cafe Latte" })).toBeInTheDocument();

    const selector = screen.getByRole("button", { name: "Restaurant location" });
    fireEvent.click(selector);
    fireEvent.click(screen.getByRole("option", { name: "Riverside Cafe" }));

    expect(
      await screen.findByRole("heading", { name: "Cafe Latte" }),
    ).toBeInTheDocument();
    const [searchAfterSwitch] = screen.getAllByRole("searchbox", {
      name: "Search menu items",
    });
    expect(searchAfterSwitch).toHaveValue("");
  });

  it("opens the drawer from the hamburger and closes it on a category choice", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => applicationResponse(input)),
    );

    render(<MenuExplorerShell />);

    const hamburger = await screen.findByRole("button", { name: "Open menu" });
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(hamburger);

    const dialog = screen.getByRole("dialog", { name: "Menu navigation" });
    expect(hamburger).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByText("Menu")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(dialog).queryByText("Orders")).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Coffee.*1 items/ }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Menu navigation" }),
      ).not.toBeInTheDocument(),
    );
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("aborts the in-flight request when the shell unmounts", () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );

    const { unmount } = render(<MenuExplorerShell />);
    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
