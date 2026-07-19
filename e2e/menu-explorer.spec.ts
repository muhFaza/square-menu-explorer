import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Every day 00:00–00:00 is treated as open around the clock, so the pill is
// deterministically "Open now" regardless of the test runner's wall clock.
const alwaysOpenHours = (
  ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const
).map((dayOfWeek) => ({
  dayOfWeek,
  startLocalTime: "00:00",
  endLocalTime: "00:00",
}));

const locations = [
  {
    id: "LOCATION1",
    name: "Downtown Cafe",
    address: null,
    timezone: "America/Los_Angeles",
    businessHours: alwaysOpenHours,
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

function menuFor(locationId: string) {
  if (locationId !== "LOCATION2") {
    const category = { id: "COFFEE", name: "Coffee" };
    const items = [
      {
        id: "LATTE",
        name: "Downtown Latte",
        description: null,
        category: category.name,
        image_url: null,
        variations: [
          { id: "SMALL", name: "Small", price: { amount: "325", currency: "USD" } },
          { id: "LARGE", name: "Large", price: { amount: "475", currency: "USD" } },
        ],
      },
    ];
    return {
      catalog: { categories: [{ ...category, items }] },
      summaries: { categories: [{ ...category, item_count: items.length }] },
    };
  }

  const tea = { id: "TEA", name: "Tea" };
  const pastries = { id: "PASTRIES", name: "Pastries" };
  const teaItems = [
    {
      id: "ICED_TEA",
      name: "Riverside Iced Tea",
      description:
        "A crisp tea with citrus, cane sugar, slow-steeped leaves, and a deliberately detailed tasting note that needs an explicit disclosure control on compact cards.",
      category: tea.name,
      image_url: null,
      variations: [
        { id: "REGULAR", name: "Regular", price: { amount: "425", currency: "USD" } },
        { id: "LARGE", name: "Large", price: null },
      ],
    },
    {
      id: "EARL_GREY",
      name: "Earl Grey",
      description: "Black tea with fragrant bergamot.",
      category: tea.name,
      image_url: null,
      variations: [
        { id: "HOT", name: "Hot", price: { amount: "350", currency: "USD" } },
        { id: "ICED", name: "Iced", price: { amount: "375", currency: "USD" } },
      ],
    },
    {
      id: "CHAI",
      name: "Spiced Chai",
      description: "Warming spices, black tea, and steamed milk.",
      category: tea.name,
      image_url: null,
      variations: [
        { id: "SMALL", name: "Small", price: { amount: "400", currency: "USD" } },
        { id: "LARGE", name: "Large", price: { amount: "475", currency: "USD" } },
      ],
    },
  ];
  const pastryItems = [
    {
      id: "CROISSANT",
      name: "Almond Croissant",
      description: "Buttery layers with toasted almond filling.",
      category: pastries.name,
      image_url: null,
      variations: [
        { id: "REGULAR", name: "Regular", price: { amount: "450", currency: "USD" } },
      ],
    },
    {
      id: "MUFFIN",
      name: "Blueberry Muffin",
      description: "Tender crumb with whole blueberries.",
      category: pastries.name,
      image_url: null,
      variations: [
        { id: "REGULAR", name: "Regular", price: { amount: "375", currency: "USD" } },
      ],
    },
    {
      id: "COOKIE",
      name: "Chocolate Cookie",
      description: null,
      category: pastries.name,
      image_url: null,
      variations: [
        { id: "REGULAR", name: "Regular", price: { amount: "275", currency: "USD" } },
      ],
    },
  ];

  return {
    catalog: {
      categories: [
        { ...tea, items: teaItems },
        { ...pastries, items: pastryItems },
      ],
    },
    summaries: {
      categories: [
        { ...tea, item_count: teaItems.length },
        { ...pastries, item_count: pastryItems.length },
      ],
    },
  };
}

async function mockApplication(page: Page, catalogRequests?: string[]) {
  await page.route("**/api/locations", (route) =>
    route.fulfill({ json: { locations } }),
  );
  await page.route("**/api/catalog**", async (route) => {
    const url = new URL(route.request().url());
    const locationId = url.searchParams.get("location_id") ?? "LOCATION1";
    const menu = menuFor(locationId);
    catalogRequests?.push(`${url.pathname}?${url.searchParams.toString()}`);
    await route.fulfill({
      json: url.pathname.endsWith("/categories")
        ? menu.summaries
        : menu.catalog,
    });
  });
}

test("loads both menu resources, navigates, selects, and restores", async ({
  page,
}, testInfo) => {
  const catalogRequests: string[] = [];
  await mockApplication(page, catalogRequests);

  await page.goto("/");

  const selector = page.getByRole("button", { name: "Restaurant location" });
  await expect(selector).toContainText("Downtown Cafe");
  await expect(page.getByRole("heading", { name: "Downtown Latte" })).toBeVisible();
  await expect(page.getByText("$3.25").first()).toBeVisible();
  await expect(page.getByText("$4.75")).toBeVisible();
  await expect(page.getByRole("img", { name: "No image available for Downtown Latte" })).toBeVisible();

  if (testInfo.project.name !== "Mobile 375px") {
    await expect(
      page.locator(".topbar .hours-pill").getByText(/Open now/),
    ).toBeVisible();
  }

  const coffeeButton = page.getByRole("button", { name: /Coffee.*1 items/ });
  await coffeeButton.click();
  await expect(coffeeButton).toHaveAttribute("aria-pressed", "true");

  await selector.click();
  await page.getByRole("option", { name: "Riverside Cafe" }).click();
  await expect(page.getByRole("heading", { name: "Riverside Iced Tea" })).toBeVisible();
  await expect(page.getByText("Price unavailable")).toBeVisible();
  const allItemsButton = page.getByRole("button", { name: /All items.*6 items/ });
  const teaButton = page.getByRole("button", { name: /Tea.*3 items/ });
  const pastriesButton = page.getByRole("button", {
    name: /Pastries.*3 items/,
  });
  await allItemsButton.focus();
  await allItemsButton.press("ArrowRight");
  await expect(teaButton).toBeFocused();
  await teaButton.press("ArrowRight");
  await expect(pastriesButton).toBeFocused();
  await pastriesButton.press("Enter");
  await expect(pastriesButton).toHaveAttribute("aria-pressed", "true");
  const readMore = page.getByRole("button", { name: "Read more" });
  await expect(readMore).toHaveAttribute("aria-expanded", "false");
  await readMore.click();
  await expect(page.getByRole("button", { name: "Show less" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("button", { name: "Show less" }).click();

  await page.reload();
  await expect(selector).toContainText("Riverside Cafe");
  await expect(page.getByRole("heading", { name: "Riverside Iced Tea" })).toBeVisible();
  await page.locator(".menu-transition").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const screenshotName =
    testInfo.project.name === "Mobile 375px"
      ? "menu-explorer-mobile-375x812.png"
      : "menu-explorer-desktop-1440x900.png";
  await page.screenshot({
    path: join(process.cwd(), "docs", "screenshots", screenshotName),
    scale: "css",
  });

  expect(catalogRequests).toEqual(
    expect.arrayContaining([
      "/api/catalog?location_id=LOCATION1",
      "/api/catalog/categories?location_id=LOCATION1",
      "/api/catalog?location_id=LOCATION2",
      "/api/catalog/categories?location_id=LOCATION2",
    ]),
  );

  if (testInfo.project.name === "Mobile 375px") {
    await expect(
      page.locator(".mobile-search").getByRole("searchbox", { name: "Search menu items" }),
    ).toBeVisible();
    // The decorative "+" is gone; the real favorite heart takes its card spot.
    await expect(page.locator(".menu-card__add")).toHaveCount(0);
    await expect(
      page
        .getByRole("heading", { name: "Riverside Iced Tea" })
        .locator("xpath=ancestor::article")
        .getByRole("button", { name: /Riverside Iced Tea to favorites/ }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await selector.click();
    await expect(page.getByRole("listbox", { name: "Restaurant location" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Escape");

    // The hamburger opens a navigation drawer that replaces the old bottom nav.
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu navigation" });
    await expect(drawer).toBeVisible();
    await expect(page.getByText("Orders")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Application sections" }),
    ).toHaveCount(0);
    // The drawer must not introduce horizontal overflow at 375px.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await drawer.getByRole("button", { name: /Tea.*3 items/ }).click();
    await expect(drawer).toHaveCount(0);
  } else {
    await expect(
      page.locator(".topbar").getByRole("searchbox", { name: "Search menu items" }),
    ).toBeVisible();
  }
});

test("filters the loaded menu client-side and restores it when cleared", async ({
  page,
}) => {
  await mockApplication(page);
  await page.goto("/");

  const selector = page.getByRole("button", { name: "Restaurant location" });
  await expect(selector).toContainText("Downtown Cafe");
  await selector.click();
  await page.getByRole("option", { name: "Riverside Cafe" }).click();
  await expect(
    page.getByRole("heading", { name: "Riverside Iced Tea" }),
  ).toBeVisible();

  // Only one search field is in the accessibility tree per breakpoint.
  const search = page.getByRole("searchbox", { name: "Search menu items" });
  await search.fill("croissant");

  await expect(
    page.getByRole("heading", { name: "Almond Croissant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Riverside Iced Tea" }),
  ).toHaveCount(0);
  // The Tea category has no match, so its section drops out entirely.
  await expect(page.getByRole("heading", { level: 2, name: "Tea" })).toHaveCount(0);
  // Category chips keep their unfiltered totals.
  await expect(page.getByRole("button", { name: /Tea.*3 items/ })).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByRole("heading", { name: "Riverside Iced Tea" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Almond Croissant" }),
  ).toBeVisible();

  // A no-match query surfaces the non-error empty state. Scoped to the app
  // content because Next's route announcer is a permanent role="alert".
  await search.fill("zzzzz");
  await expect(
    page.getByRole("heading", { name: "No items match your search" }),
  ).toBeVisible();
  await expect(page.locator(".content-panel [role='alert']")).toHaveCount(0);
});

test("favorites persist across reload and drive a dedicated favorites view", async ({
  page,
}, testInfo) => {
  await mockApplication(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Downtown Latte" }),
  ).toBeVisible();

  const addFavorite = page.getByRole("button", {
    name: "Add Downtown Latte to favorites",
  });
  await addFavorite.click();
  await expect(
    page.getByRole("button", { name: "Remove Downtown Latte from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Favorites survive a full reload (they live in localStorage, not the URL).
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Downtown Latte from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");

  if (testInfo.project.name === "Mobile 375px") {
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu navigation" });
    await drawer.getByRole("button", { name: /Favorites/ }).click();
    await expect(drawer).toHaveCount(0);
  } else {
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Favorites/ })
      .click();
  }

  await expect(
    page.getByRole("heading", { name: "My Favorites" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Downtown Latte" }),
  ).toBeVisible();

  // Unfavoriting the last item collapses the list to its empty state.
  await page
    .getByRole("button", { name: "Remove Downtown Latte from favorites" })
    .click();
  await expect(
    page.getByRole("heading", { name: "No favorites yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Browse the menu" }).click();
  await expect(
    page.getByRole("heading", { name: "Downtown Latte" }),
  ).toBeVisible();
});

test("leaving favorites for a category scrolls to that section, not the top", async ({
  page,
}, testInfo) => {
  await mockApplication(page);
  await page.goto("/");

  const selector = page.getByRole("button", { name: "Restaurant location" });
  await selector.click();
  await page.getByRole("option", { name: "Riverside Cafe" }).click();
  await expect(
    page.getByRole("heading", { name: "Riverside Iced Tea" }),
  ).toBeVisible();

  // Favorite a pastry so the favorites view has content to leave from.
  await page
    .getByRole("button", { name: "Add Almond Croissant to favorites" })
    .click();

  const isMobile = testInfo.project.name === "Mobile 375px";
  const openNav = async () => {
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      return page.getByRole("dialog", { name: "Menu navigation" });
    }
    return page.locator(".sidebar");
  };

  await (await openNav()).getByRole("button", { name: /Favorites/ }).click();
  await expect(
    page.getByRole("heading", { name: "My Favorites" }),
  ).toBeVisible();

  // Choosing Pastries returns to the full menu and lands on that section, which
  // only mounts after the view flips — so the scroll must be deferred, not lost.
  await (await openNav())
    .getByRole("button", { name: /Pastries.*3 items/ })
    .click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Pastries" }),
  ).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("a rapid location switch shows a skeleton and cannot reveal the older menu", async ({ page }) => {
  await page.route("**/api/locations", (route) => route.fulfill({ json: { locations } }));
  await page.route("**/api/catalog**", async (route) => {
    const url = new URL(route.request().url());
    const locationId = url.searchParams.get("location_id") ?? "LOCATION1";
    await new Promise((resolve) =>
      setTimeout(resolve, locationId === "LOCATION1" ? 350 : 150),
    );
    const menu = menuFor(locationId);
    await route.fulfill({
      json: url.pathname.endsWith("/categories") ? menu.summaries : menu.catalog,
    }).catch(() => undefined);
  });

  await page.goto("/");
  const selector = page.getByRole("button", { name: "Restaurant location" });
  await expect(selector).toContainText("Downtown Cafe");
  await selector.click();
  await page.getByRole("option", { name: "Riverside Cafe" }).click();
  await expect(page.locator(".menu-loading-skeleton")).toBeVisible();
  await expect(page.getByText("Loading menu for Riverside Cafe.")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Riverside Iced Tea" })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByRole("heading", { name: "Downtown Latte" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Riverside Iced Tea" })).toBeVisible();
});

test("shows a retry state and recovers when Locations succeeds", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/locations", async (route) => {
    requestCount += 1;
    await route.fulfill(
      requestCount === 1
        ? { status: 503, json: { error: { code: "SQUARE_UNAVAILABLE", message: "Unavailable" } } }
        : { json: { locations } },
    );
  });
  await page.route("**/api/catalog**", async (route) => {
    const url = new URL(route.request().url());
    const menu = menuFor("LOCATION1");
    await route.fulfill({ json: url.pathname.endsWith("/categories") ? menu.summaries : menu.catalog });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Locations couldn't load" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Downtown Latte" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restaurant location" }),
  ).toBeFocused();
  expect(requestCount).toBe(2);
});

test("moves focus to the empty heading when a Locations retry returns no active locations", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/locations", async (route) => {
    requestCount += 1;
    await route.fulfill(
      requestCount === 1
        ? {
            status: 503,
            json: {
              error: { code: "SQUARE_UNAVAILABLE", message: "Unavailable" },
            },
          }
        : { json: { locations: [] } },
    );
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Locations couldn't load" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  const emptyHeading = page.getByRole("heading", {
    name: "No active locations",
  });
  await expect(emptyHeading).toBeVisible();
  await expect(emptyHeading).toBeFocused();
  await expect(emptyHeading).toHaveAttribute("tabindex", "-1");
  expect(requestCount).toBe(2);
});

test("shows a menu retry state and refetches the endpoint pair", async ({ page }) => {
  await page.route("**/api/locations", (route) => route.fulfill({ json: { locations } }));
  let catalogRequestCount = 0;
  await page.route("**/api/catalog**", async (route) => {
    catalogRequestCount += 1;
    const url = new URL(route.request().url());
    if (catalogRequestCount <= 2) {
      await route.fulfill({ status: 503, json: { error: { code: "SQUARE_UNAVAILABLE", message: "Unavailable" } } });
      return;
    }
    const menu = menuFor("LOCATION1");
    await route.fulfill({ json: url.pathname.endsWith("/categories") ? menu.summaries : menu.catalog });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Menu couldn't load" })).toBeVisible();
  await page.getByRole("button", { name: "Retry menu" }).click();
  await expect(page.getByRole("heading", { name: "Downtown Latte" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Downtown Cafe" })).toBeFocused();
  expect(catalogRequestCount).toBe(4);
});

test("shows stable location and menu skeletons before the first menu is ready", async ({
  page,
}) => {
  let releaseLocations: () => void = () => undefined;
  const locationsGate = new Promise<void>((resolve) => {
    releaseLocations = resolve;
  });
  let releaseCatalog: () => void = () => undefined;
  const catalogGate = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await page.route("**/api/locations", async (route) => {
    await locationsGate;
    await route.fulfill({ json: { locations } });
  });
  await page.route("**/api/catalog**", async (route) => {
    await catalogGate;
    const url = new URL(route.request().url());
    const menu = menuFor("LOCATION1");
    await route.fulfill({
      json: url.pathname.endsWith("/categories")
        ? menu.summaries
        : menu.catalog,
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Finding your locations" })).toBeVisible();
  await expect(page.locator(".menu-loading-skeleton")).toBeVisible();
  await expect(page.getByText("Loading restaurant locations.")).toHaveCount(1);

  releaseLocations();
  await expect(
    page.getByRole("button", { name: "Restaurant location" }),
  ).toContainText("Downtown Cafe");
  await expect(page.locator(".menu-loading-skeleton")).toBeVisible();
  await expect(page.getByText("Loading menu for Downtown Cafe.")).toHaveCount(1);
  releaseCatalog();
  await expect(page.getByRole("heading", { name: "Downtown Latte" })).toBeVisible();
  await expect(page.locator(".menu-loading-skeleton")).toHaveCount(0);
});

test("toggles to the dark theme and remembers it across a reload", async ({
  page,
}) => {
  await mockApplication(page);
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
});

test("shows a useful empty catalog state without horizontal overflow", async ({
  page,
}) => {
  await page.route("**/api/locations", (route) =>
    route.fulfill({ json: { locations } }),
  );
  await page.route("**/api/catalog**", (route) =>
    route.fulfill({ json: { categories: [] } }),
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No menu items here yet" }),
  ).toBeVisible();
  await expect(page.locator(".content-panel [role='status']")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
