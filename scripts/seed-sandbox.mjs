// Seeds the Square SANDBOX with extra locations and catalog items so the app can
// demonstrate per-location menus. Idempotent and sandbox-only. Run with:
//   node scripts/seed-sandbox.mjs
//
// Safety: this script never prints or writes the access token. It may read
// .env.local to populate process.env, but it never echoes any value from it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { SquareClient, SquareEnvironment } from "square";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

/** Parses .env.local (KEY=VALUE lines) into process.env without overriding set vars. */
function loadEnvLocal() {
  let contents;
  try {
    contents = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  } catch {
    return; // Rely on the ambient environment when the file is absent.
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Serializes BigInt-bearing objects safely (Money amounts are BigInt in this SDK). */
function toJson(value) {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? `${v}n` : v),
    2,
  );
}

const usd = (cents) => ({ amount: BigInt(cents), currency: "USD" });

/** Normalizes a presence intent into the three CatalogObject presence fields. */
function presenceFields(presence) {
  return {
    presentAtAllLocations: presence.presentAtAllLocations,
    presentAtLocationIds: presence.presentAtLocationIds,
    absentAtLocationIds: presence.absentAtLocationIds,
  };
}

// A variation must not be enabled where its parent item is disabled, so each
// variation inherits the item's presence unless it declares a narrower override.
function fixedVariation(clientId, itemClientId, name, cents, presence) {
  return {
    type: "ITEM_VARIATION",
    id: clientId,
    ...presenceFields(presence),
    itemVariationData: {
      itemId: itemClientId,
      name,
      pricingType: "FIXED_PRICING",
      priceMoney: usd(cents),
    },
  };
}

const ALL_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function businessHours(startLocalTime, endLocalTime) {
  return {
    periods: ALL_DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      startLocalTime,
      endLocalTime,
    })),
  };
}

async function main() {
  loadEnvLocal();

  const environment = process.env.SQUARE_ENVIRONMENT;
  const token = process.env.SQUARE_ACCESS_TOKEN;

  if (environment !== "sandbox") {
    throw new Error(
      `Refusing to seed: SQUARE_ENVIRONMENT must be "sandbox" (got "${environment ?? "undefined"}").`,
    );
  }
  if (!token) {
    throw new Error("Missing SQUARE_ACCESS_TOKEN in the environment.");
  }

  const client = new SquareClient({
    token,
    environment: SquareEnvironment.Sandbox,
  });

  const CATEGORY = {
    coffee: "YHHU5XO3ZDZL35RP6BZ7LULF",
    tea: "MQRFNPWQELXJP2VPYOLC2QBB",
    pastries: "TKUC36KNXPP6TEYCKXNWEWWI",
    breakfast: "UKBI7IUBFBSZOVKVG3EER3XM",
  };

  const summary = [];

  // --- Locations -----------------------------------------------------------
  const existingLocations = (await client.locations.list()).locations ?? [];
  const locationIdByName = new Map(
    existingLocations
      .filter((loc) => typeof loc.name === "string")
      .map((loc) => [loc.name, loc.id]),
  );

  const desiredLocations = [
    {
      name: "Riverside Cafe",
      timezone: "America/New_York",
      address: {
        addressLine1: "412 Riverside Drive",
        locality: "New York",
        administrativeDistrictLevel1: "NY",
        postalCode: "10025",
        country: "US",
      },
      businessHours: businessHours("07:00:00", "21:00:00"),
      description: "Riverside neighborhood cafe",
    },
    {
      name: "Harbor Point Roastery",
      timezone: "America/Los_Angeles",
      address: {
        addressLine1: "89 Harbor Point Blvd",
        locality: "San Francisco",
        administrativeDistrictLevel1: "CA",
        postalCode: "94111",
        country: "US",
      },
      businessHours: businessHours("07:00:00", "21:00:00"),
      description: "Harbor Point specialty roastery",
    },
  ];

  for (const desired of desiredLocations) {
    if (locationIdByName.has(desired.name)) {
      summary.push({
        name: desired.name,
        kind: "location",
        action: "skipped (exists)",
        availability: "n/a",
      });
      continue;
    }

    const response = await client.locations.create({
      location: { ...desired, status: "ACTIVE" },
    });
    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Failed to create location "${desired.name}": ${toJson(response.errors)}`,
      );
    }
    const created = response.location;
    locationIdByName.set(desired.name, created.id);
    summary.push({
      name: desired.name,
      kind: "location",
      action: "created",
      availability: "ACTIVE",
    });
  }

  // The sandbox's original location was renamed to "Downtown Cafe" on 2026-07-19.
  const defaultId =
    locationIdByName.get("Downtown Cafe") ??
    locationIdByName.get("Default Test Account");
  const riversideId = locationIdByName.get("Riverside Cafe");
  const harborId = locationIdByName.get("Harbor Point Roastery");
  if (!defaultId || !riversideId || !harborId) {
    throw new Error("Could not resolve all required location IDs after seeding.");
  }

  // --- Existing catalog items ---------------------------------------------
  const itemObjectByName = new Map();
  let cursor;
  do {
    const page = await client.catalog.search({
      objectTypes: ["ITEM"],
      includeRelatedObjects: false,
      ...(cursor ? { cursor } : {}),
    });
    if (page.errors && page.errors.length > 0) {
      throw new Error(`Catalog search failed: ${toJson(page.errors)}`);
    }
    for (const object of page.objects ?? []) {
      if (object.type === "ITEM" && object.itemData?.name) {
        itemObjectByName.set(object.itemData.name, object);
      }
    }
    cursor = page.cursor;
  } while (cursor);

  // --- Modify presence of a few existing items ----------------------------
  const presenceUpdates = [
    {
      name: "Avocado Toast",
      presence: { presentAtAllLocations: true, absentAtLocationIds: [harborId] },
      intent: "everywhere except Harbor Point Roastery",
    },
    {
      name: "Egg and Cheese Sandwich",
      presence: { presentAtAllLocations: true, absentAtLocationIds: [harborId] },
      intent: "everywhere except Harbor Point Roastery",
    },
    {
      name: "Matcha Latte",
      presence: { presentAtAllLocations: true, absentAtLocationIds: [riversideId] },
      intent: "everywhere except Riverside Cafe",
    },
  ];

  const updateBatchObjects = [];
  for (const update of presenceUpdates) {
    const object = itemObjectByName.get(update.name);
    if (!object) {
      summary.push({
        name: update.name,
        kind: "item",
        action: "skipped (not found)",
        availability: update.intent,
      });
      continue;
    }
    // Mirror the item's presence onto every variation so none stays enabled
    // where the parent item is now disabled.
    const variations = (object.itemData?.variations ?? []).map((variation) => ({
      ...variation,
      presentAtAllLocations: update.presence.presentAtAllLocations,
      presentAtLocationIds: undefined,
      absentAtLocationIds: update.presence.absentAtLocationIds,
    }));
    updateBatchObjects.push({
      ...object,
      presentAtAllLocations: update.presence.presentAtAllLocations,
      presentAtLocationIds: undefined,
      absentAtLocationIds: update.presence.absentAtLocationIds,
      itemData: { ...object.itemData, variations },
    });
    summary.push({
      name: update.name,
      kind: "item",
      action: "updated presence",
      availability: update.intent,
    });
  }

  if (updateBatchObjects.length > 0) {
    const response = await client.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [{ objects: updateBatchObjects }],
    });
    if (response.errors && response.errors.length > 0) {
      throw new Error(`Presence update failed: ${toJson(response.errors)}`);
    }
  }

  // --- Create new items demonstrating each presence mechanism --------------
  const newItems = [
    {
      name: "Flat White",
      categoryId: CATEGORY.coffee,
      description: "Espresso with steamed microfoam.",
      presence: { presentAtAllLocations: true },
      intent: "all locations (Large absent at Riverside)",
      variations: [
        { name: "Small", cents: 400 },
        // Large is unavailable at Riverside to exercise variation-level presence.
        {
          name: "Large",
          cents: 500,
          presence: {
            presentAtAllLocations: true,
            absentAtLocationIds: [riversideId],
          },
        },
      ],
    },
    {
      name: "Cold Brew",
      categoryId: CATEGORY.coffee,
      description: "Slow-steeped cold brew coffee.",
      presence: {
        presentAtAllLocations: false,
        presentAtLocationIds: [riversideId, harborId],
      },
      intent: "Riverside Cafe and Harbor Point Roastery only",
      variations: [
        { name: "Regular", cents: 450 },
        { name: "Large", cents: 550 },
      ],
    },
    {
      name: "Chai Latte",
      categoryId: CATEGORY.tea,
      description: "Spiced black tea with steamed milk.",
      presence: { presentAtAllLocations: true },
      intent: "all locations",
      variations: [
        { name: "Small", cents: 425 },
        { name: "Large", cents: 525 },
      ],
    },
    {
      name: "Iced Hibiscus Tea",
      categoryId: CATEGORY.tea,
      description: "Tart hibiscus tea served over ice.",
      presence: {
        presentAtAllLocations: false,
        presentAtLocationIds: [riversideId],
      },
      intent: "Riverside Cafe only",
      variations: [{ name: "Regular", cents: 400 }],
    },
    {
      name: "Cinnamon Roll",
      categoryId: CATEGORY.pastries,
      description: "Warm cinnamon roll with cream cheese icing.",
      presence: {
        presentAtAllLocations: true,
        absentAtLocationIds: [defaultId],
      },
      intent: "everywhere except Downtown Cafe (the renamed default location)",
      variations: [{ name: "Regular", cents: 475 }],
    },
    {
      name: "Banana Bread",
      categoryId: CATEGORY.pastries,
      description: "Moist banana bread with walnuts.",
      presence: {
        presentAtAllLocations: false,
        presentAtLocationIds: [harborId],
      },
      intent: "Harbor Point Roastery only",
      variations: [{ name: "Regular", cents: 350 }],
    },
  ];

  const createBatchObjects = [];
  for (const item of newItems) {
    if (itemObjectByName.has(item.name)) {
      summary.push({
        name: item.name,
        kind: "item",
        action: "skipped (exists)",
        availability: item.intent,
      });
      continue;
    }

    const itemClientId = `#item-${item.name.replace(/\s+/g, "-").toLowerCase()}`;
    const variations = item.variations.map((variation, index) =>
      fixedVariation(
        `${itemClientId}-var-${index}`,
        itemClientId,
        variation.name,
        variation.cents,
        variation.presence ?? item.presence,
      ),
    );

    createBatchObjects.push({
      type: "ITEM",
      id: itemClientId,
      presentAtAllLocations: item.presence.presentAtAllLocations,
      ...(item.presence.presentAtLocationIds
        ? { presentAtLocationIds: item.presence.presentAtLocationIds }
        : {}),
      ...(item.presence.absentAtLocationIds
        ? { absentAtLocationIds: item.presence.absentAtLocationIds }
        : {}),
      itemData: {
        name: item.name,
        description: item.description,
        categories: [{ id: item.categoryId }],
        variations,
      },
    });
    summary.push({
      name: item.name,
      kind: "item",
      action: "created",
      availability: item.intent,
    });
  }

  if (createBatchObjects.length > 0) {
    const response = await client.catalog.batchUpsert({
      idempotencyKey: randomUUID(),
      batches: [{ objects: createBatchObjects }],
    });
    if (response.errors && response.errors.length > 0) {
      throw new Error(`Item creation failed: ${toJson(response.errors)}`);
    }
  }

  // --- Summary -------------------------------------------------------------
  console.log("\nSeeding complete. Actions taken:\n");
  console.table(summary);
}

main().catch((error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exitCode = 1;
});
