# Square Menu Explorer

A mobile-first, full-stack menu browser for the Per Diem coding challenge. The application securely reads Square data through server-side Next.js Route Handlers. Phase 10 completes mandatory hardening, test/documentation traceability, and durable submission screenshots around the race-safe, accessible menu experience.

## Prerequisites

- Node.js 20 from 20.19.0, Node.js 22 from 22.13.0, or Node.js 24 and newer (the exact engine range is `^20.19.0 || ^22.13.0 || >=24.0.0`; verified with `v24.15.0`)
- pnpm 10 (the project records `pnpm@10.14.0`)
- A Square Sandbox application with an access token and catalog data for live local browsing (the deterministic test suite does not require credentials)

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and provide local values. Never commit the resulting file or expose the access token through a `NEXT_PUBLIC_` variable. Server configuration accepts:

   - `SQUARE_ACCESS_TOKEN`: required, non-empty, server-only token.
   - `SQUARE_ENVIRONMENT`: required; exactly `sandbox` or `production`.
   - `PORT`: required integer from 1 through 65535.
   - `SQUARE_APPLICATION_ID`: optional identification value; it is not used to authenticate current server requests.

3. Start the local development server with the project's single development command:

   ```bash
   pnpm dev
   ```

After the one-time install and environment setup, `pnpm dev` is the only command required to start the complete frontend and backend locally. The coding-agent workflow does not run the development server; it validates with a production build and production server instead.

### Seeding the sandbox

To populate a Sandbox account with multiple locations and per-location menu variety, run:

```bash
node scripts/seed-sandbox.mjs
```

The script reads `.env.local`, refuses to run unless `SQUARE_ENVIRONMENT=sandbox`, and never prints the access token. It renames the default `Default Test Account` location to `Downtown Cafe` (America/New_York, seven-day 07:00-21:00 business hours) and adds two more locations, Riverside Cafe and Harbor Point Roastery, each with business hours; its name resolution accepts either the original or renamed default so re-runs stay stable. It creates or adjusts roughly six catalog items that exercise every presence mechanism the app renders: `present_at_all_locations`, `present_at_location_ids`, `absent_at_location_ids`, and one variation-level absence (Flat White Large absent at Riverside). It also assigns Americano to Coffee, Blueberry Muffin to Pastries, and Chai Latte (whose category reference was lost in a seeder retry-batch) to Tea via versioned catalog upserts, so no `Uncategorized` items remain in the seed; the fallback itself was working as designed and remains covered by tests. It is idempotent — existing locations and items are skipped, so it is safe to re-run.

Two Square behaviors are worth recording: `SearchCatalogObjects` with related objects returns referenced IMAGE objects but not the `CatalogCategory` objects behind the modern `item_data.categories[]` array, so the gateway runs a second CATEGORY search pass (see below); and a variation cannot be enabled at a location where its parent item is disabled — variations inherit item presence unless narrowed further.

## Quality commands

```bash
pnpm lint:fix    # ESLint autofix followed by strict TypeScript checking
pnpm test        # deterministic Vitest component/unit tests
pnpm build       # production Next.js build
pnpm test:e2e    # fresh build, then Playwright against `next start` on port 3100
pnpm verify      # all gates with one build before the internal E2E step
```

Run `pnpm exec playwright install chromium` once if the Chromium test browser is not already installed.

## Docker

The app builds and serves through Docker Compose as a small standalone image (`next.config.ts` sets `output: "standalone"`). Runtime secrets are supplied by the local, uncommitted `.env.local` and are never baked into the image.

```bash
docker compose up --build    # build the image and serve the production app
```

- The published port follows `PORT` from `.env.local` (`${PORT:-3000}:3000`), so `http://localhost:3000` by default.
- `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT`, and `PORT` are read at runtime from `.env.local`; keep that file out of version control.
- A healthcheck polls `GET /api/locations` to confirm the server is serving.

## Test strategy

| Level | Real boundary | Controlled boundary | Regression prevented |
| --- | --- | --- | --- |
| Unit | Pure environment, error, availability, mapping, money, cache, and browser-validator logic | Fake SDK-shaped values, clocks, and inputs | Incorrect Square semantics, precision loss, expired caching, malformed public data, or secret-bearing diagnostics |
| Integration | Route Handler → logging → service → cache → gateway → mapper composition | Only Square SDK client methods and time/ID effects | Incorrect HTTP status/body/headers, partial pagination, cache projection drift, missing logs, or raw Square error leakage |
| Component | Real React hooks and components in jsdom | Same-origin `fetch`, storage, observer, motion, and layout measurements | Broken selection persistence, async states, retry focus, stale-response handling, category keyboard semantics, or disclosure behavior |
| End-to-end | Built Next.js application in desktop and exact-375px Chromium | Public HTTP endpoint responses are intercepted; Square and local credentials are never used | Broken production rendering, endpoint coordination, persistence, race safety, responsive overflow, retry recovery, or screenshot drift |

`pnpm verify` runs every level with one production build. The deterministic suite does not require Square credentials; an optional sanitized Sandbox smoke supplements rather than replaces it.

## Implemented menu experience

The root page started from the supplied `docs/DekstopUI.png` and `docs/MobileUI.png` references and then took several user-directed navigation changes that deviate from those mockups:

- a warm ivory (or warm dark-roast) canvas, espresso accents, Nunito typography, a hand-drawn inline SVG icon set, light/dark theming, and a full-bleed layout with no desktop application frame;
- a sticky full-width top bar with an accessible custom location dropdown, a live open/closed hours pill, a search field, and a dark-mode toggle; a sticky viewport-fit category sidebar with per-category icons and item-count badges, Favorites/Menu/About entries, and its own internal scroll; grouped menu cards; and location-aware states. The decorative filter and bell buttons and the connection-status pill were removed;
- a 375px mobile top bar with the hamburger button at the left (hamburger, location, theme toggle), a search bar and horizontal category chips that share one sticky container so they scroll without jitter, image-left menu cards, and a focus-trapped slide-in drawer (`role="dialog"`, `aria-modal`) holding category navigation plus Menu/Favorites/About. The fixed bottom navigation and the Orders destination were removed;
- real open/closed status derived from each location's Square business hours, client-side menu search, per-item favorites, and working category navigation and menu display. About and item detail remain the only deferred, non-interactive placeholders.

Menu search filters the loaded catalog client-side by item name and description (case-insensitive), keeps the category grouping, hides zero-match categories, and leaves the sidebar counts unfiltered. The `searchQuery` state lives in the shell and resets on location change; a debounced polite live region announces "N items match", and a non-error empty state offers a Clear search action.

Favorites are a per-item heart toggle stored in `localStorage` (global across locations, synced across tabs, tolerant of corrupt JSON). The heart sits in the thumbnail corner on desktop and in the card's bottom-right espresso circle on mobile (which replaced the earlier decorative "+" button). A Favorites view groups favorited, currently present items by category, honors the active search, and shows a "No favorites yet" empty state; Favorites counts appear in the sidebar and mobile drawer, and selecting a category exits Favorites mode. Choosing a category from the Favorites view defers its scroll until the menu sections render, so it lands on the section rather than at page top.

Dark mode is resolved by a `useTheme()` hook (stored preference, then `prefers-color-scheme`, then light) and toggled from the top bar. An inline script in the document head applies the saved theme before paint to prevent a flash, and theme transitions are gated to run only after mount and only when reduced motion is not requested.

On mount, `useLocationSelection()` calls the same-origin `GET /api/locations` endpoint with an abort signal. The response is validated before use. The hook accepts a versioned `localStorage` value only when that ID still exists in the active response; otherwise it chooses and persists the first active location. A selector change updates React state and persistence immediately. Storage access is best-effort, so blocked or throwing `localStorage` does not prevent session-only selection.

The location selector is a custom accessible dropdown built to the ARIA APG select-only combobox/listbox disclosure pattern rather than a native `<select>`: a button trigger exposes `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls`; the popup is a `role="listbox"` with `role="option"` children and `aria-activedescendant` tracking. Keyboard users open and navigate with Enter/Space/Arrow keys, jump with Home/End, select with Enter/Space, close without selecting on Escape (focus returns to the trigger), and close on Tab, while an outside click also dismisses it. The open animation is disabled under `prefers-reduced-motion`, and the control does not overflow horizontally at 375px.

The top-bar hours pill reflects the selected location's live open/closed status. The pure `getOpenStatus(location, now?)` helper reads the location's Square business hours in its IANA timezone with `Intl.DateTimeFormat`, handling periods that span midnight, multiple periods per day, and malformed times, and returns an open state with a closing-time label or a closed state with the next opening time (12-hour labels such as `9:00 PM`). Square times stay location-local strings until presentation, so no date library is added. The pill refreshes every 60 seconds and renders nothing when hours or timezone are missing or locations are not yet ready.

The shell has accessible, layout-stable loading, retryable error, and empty states for both locations and menus. Initial location loading and every menu switch reserve the final card geometry with decorative, assistive-technology-hidden skeletons instead of a blank canvas. Each async state has one useful announcement; location error recovery returns focus to the selector when locations are ready or to the empty-state heading when none are active, while menu recovery focuses its ready/empty heading. Initial empty responses do not move focus. Once a location is ready, `useMenuCatalog()` starts `/api/catalog` and `/api/catalog/categories` concurrently with one abort signal. A location change aborts both requests and increments a sequence guard, so an older response cannot overwrite the newer menu even if cancellation races with completion. Retry refetches the pair.

Both response bodies cross strict runtime validators before React sees them. Each fetch performs HTTP and JSON validation inside its own concurrent promise, so one fast failure rejects immediately and lets the hook abort its stalled sibling. Unknown keys, malformed DTOs, duplicate category IDs, different category order/name/count, or mixed endpoint snapshots fail as one safe menu error instead of producing contradictory navigation. Image strings are trimmed and retained only when they are absolute HTTP(S) URLs; blank, malformed, relative, or unsafe-protocol values normalize to `null` and use the deterministic fallback.

Category navigation offers `All items` plus every real nonempty group on desktop and mobile. It uses a single tab stop: Arrow keys move focus with wrapping, Home/End jump to the boundaries, and native button activation selects a category. Clicks and keyboard activation use smooth scrolling, while `IntersectionObserver` updates the active category during browsing; a scroll-position fallback covers browsers without the observer. Users who request reduced motion get instant scrolling with shimmer, entry, and hover animations disabled. Desktop image-top cards and image-left mobile rows use square 1:1 images with a deterministic gradient-and-cup fallback and keep multiple items above the fold. Each card shows the item name, a `From $X.XX` lowest-price line computed by `BigInt` comparison (the exact price when a single variation exists), every variation in wrapping chips, and explicit missing image/description/price states. Long descriptions are visually clamped until a stable `aria-controls`/`aria-expanded` Read more/Show less control reveals the complete text; short or missing descriptions do not show a redundant control. Money stays in integer minor units until `formatCatalogMoney()` uses `BigInt` and locale-aware `Intl.NumberFormat`, preserving values beyond JavaScript's safe integer range, currency-specific precision, and localized integer and fraction digits without hardcoding `$`.

## Screenshots

The production E2E suite waits for entry animations to settle before refreshing these durable viewport captures under `docs/screenshots/`. The Nunito UI font is fetched at build time through `next/font/google`, so the first production build requires network access.

### Desktop — 1440×900

![Square Menu Explorer desktop menu at 1440 by 900](docs/screenshots/menu-explorer-desktop-1440x900.png)

### Mobile — 375×812

![Square Menu Explorer mobile menu at 375 by 812](docs/screenshots/menu-explorer-mobile-375x812.png)

## Architecture decisions and trade-offs

| Decision | Why | Trade-off |
| --- | --- | --- |
| One Next.js App Router application | Delivers the single-page UI and server-only proxy in one deployable project | Frontend and backend scale together; Route Handlers are less independently deployable than a separate API service |
| Official Square SDK behind lazy `server-only` gateways | Keeps authentication and vendor types out of browser modules while retaining typed API calls | The exact SDK version is pinned, increasing server install size and requiring deliberate upgrades |
| Pure mapper plus explicit gateway/service/route layers | Makes Square relationships, availability, money, and failures independently testable and interview-explainable | More files and boundaries than an inline Route Handler implementation |
| Complete pagination before mapping or return | Prevents partial menus and preserves related-object joins | A late-page failure rejects the whole request and requires retry |
| One normalized five-minute in-memory cache per location | Both catalog endpoints share one snapshot and repeated requests avoid Square | Cache state is process-local, can be stale until TTL expiry, and is not shared across serverless instances |
| Fetch and strictly reconcile catalog plus category projections in the browser | Exercises both required endpoints and prevents contradictory navigation/counts | Projection drift becomes a clean retryable menu error instead of rendering partial content |
| Native React/browser APIs for async state, focus, scrolling, and motion | Keeps bundle and maintenance cost low and exposes challenge-relevant logic | The project owns abort, sequence, focus, and runtime-validation code that a larger state library could provide |

### Implementation structure

- **Next.js App Router** provides a single deployable frontend/backend application and hosts a dynamic Node.js Route Handler for the Locations API.
- **Strict TypeScript** makes contracts explicit and catches integration mistakes before runtime.
- **Tailwind CSS** supplies a mobile-first styling vocabulary with no client-side runtime.
- **Server-only configuration** validates and freezes trimmed environment values only when requested; importing a module does not read or cache `process.env`.
- **Square SDK factory and gateways** keep the access token, `client.locations.list()`, and `client.catalog.search()` behind `server-only` boundaries. `square@45.0.1` remains exact-pinned because SDK releases carry a particular Square API contract.
- **Catalog pagination gateway** runs two cursor loops through one generic per-type helper: an `objectTypes: ["ITEM"]`, `includeRelatedObjects: true` pass that collects every item plus its related IMAGE objects, followed by an `objectTypes: ["CATEGORY"]` pass. Square returns referenced images as related objects but not the `CatalogCategory` records behind the modern `item_data.categories[]` array, so the second pass fetches those categories and merges them into `relatedObjects` for the mapper's existing join. Both passes share the same invalid/repeated-cursor and page-limit defenses, deduplicate related objects by ID in first-seen order, and return only after their final page, so a later-page failure cannot expose partial data.
- **Pagination defenses** reject blank, padded, non-string, or repeated cursors and cap one retrieval at 1,000 pages. Malformed non-ITEM primary objects or related objects without IDs fail cleanly instead of silently weakening later joins.
- **Pure catalog mapper** takes the complete raw result and a location ID, builds category/image indexes, applies the same exact availability rule to items and nested variations, omits items with no available variation, and groups the remainder without network, environment, cache, or logging side effects.
- **Relationship policy** chooses the first resolvable ID in the ordered `itemData.categories` list, then tries the deprecated `categoryId` for legacy data. Unresolved items use one synthetic `Uncategorized` group. Images similarly use the first resolvable ordered item image, with the CatalogObject `imageId` as a compatibility fallback.
- **Public catalog DTOs** keep optional descriptions, images, and prices explicitly nullable. Fixed prices preserve Square's integer minor-unit amount as a base-10 string plus ISO currency, so values beyond JavaScript's safe-integer range remain exact and the complete result is safe for `JSON.stringify`.
- **Catalog service** composes active-location validation, complete Catalog retrieval, Phase 5 mapping, and categories projection. Unknown, inactive, and no-active-location cases share one clean 404 policy and never call SearchCatalogObjects.
- **Shared in-memory TTL cache** stores one mapped `CatalogResponse` per deterministic `catalog:<locationId>` key for five minutes. Both endpoint services import the same process-local cache; concurrent misses share one promise, successful TTL begins after loading, expired entries refresh, and failures are never cached.
- **Strict catalog Route Handlers** require exactly one unpadded 1&ndash;32 character alphanumeric `location_id`, return clean 400 errors for missing/duplicate/blank/malformed values, and compose the existing no-store/request-ID/error/logging boundaries on the dynamic Node.js runtime.
- **Locations service and pure mapper** filter out every non-`ACTIVE` record, validate required active-location identifiers/names, normalize optional fields, and return only the public DTO. The service depends on a small gateway interface rather than SDK construction.
- **Application/public error split** keeps diagnostic messages and causes server-side while returning a stable `{ error: { code, message, requestId? } }` contract with `Cache-Control: no-store`.
- **Square error mapper** classifies upstream authentication failures, rate limits, and generic SDK/network failures without copying raw Square messages or response bodies into public output.
- **Request logging wrapper** surrounds the endpoint and emits one JSON event with request ID, method, pathname, mapped status, and nonnegative duration. It deliberately excludes query strings, headers, bodies, and error details.
- **Vitest + Testing Library** cover isolated component behavior in a fast DOM simulation.
- **Playwright** verifies that the compiled application is actually served and visible in desktop Chromium and an exact 375px-wide mobile Chromium project.

No database exists. Deterministic tests control fake Square and browser HTTP boundaries and never use local credentials.

## Raw catalog retrieval

`createSquareCatalogGateway()` exposes an internal `fetchCatalog()` operation to the Phase 6 service. The raw result is not itself an HTTP contract; it retains SDK types for the Phase 5 mapper:

```ts
interface RawCatalogResult {
  readonly items: readonly CatalogObject.Item[];
  readonly relatedObjects: readonly CatalogObject[];
}
```

Retrieval runs two typed passes. The ITEM pass's first SearchCatalogObjects request omits a cursor and requests related objects; each later request sends exactly the non-empty cursor returned by the previous response while retaining the ITEM and related-object options. A second CATEGORY pass then paginates the `item_data.categories[]` targets that Square does not return as related objects, merging them into `relatedObjects`. Repeated category/image objects can appear across pages; the gateway keeps the first object for each ID and preserves first-seen order. Any Square error, typed response error, invalid cursor, malformed object, or page-limit breach rejects the entire operation with a sanitized application error.

## Catalog mapping contract

`mapCatalogForLocation(rawCatalog, locationId)` is a pure function; it does not call Square or expose SDK objects. Its output is the implemented full Catalog endpoint contract:

```ts
interface CatalogResponse {
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
    readonly items: readonly {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly category: string;
      readonly image_url: string | null;
      readonly variations: readonly {
        readonly id: string;
        readonly name: string;
        readonly price: { amount: string; currency: string } | null;
      }[];
    }[];
  }[];
}
```

Availability follows Square's `CatalogObject` contract exactly:

- `presentAtAllLocations` omitted or `true`: present unless `absentAtLocationIds` contains the selected location.
- `presentAtAllLocations` `false`: present only when `presentAtLocationIds` contains the selected location.
- An item is published only when the item itself is present and at least one nested variation is present. Present variations are mapped independently and remain in Square order.

The mapper treats missing optional relationships as normal: descriptions, image URLs, and fixed prices become `null`; missing or unresolvable categories become `Uncategorized`. Conversely, malformed required item/variation IDs, names, type-specific data, nested object types, or incomplete money objects fail atomically with a sanitized server error rather than returning a partially trustworthy menu.

## Catalog endpoints

Both endpoints require exactly one active Square location ID:

```text
GET /api/catalog?location_id=<LOCATION_ID>
GET /api/catalog/categories?location_id=<LOCATION_ID>
```

`GET /api/catalog` returns the grouped `CatalogResponse` documented above. `GET /api/catalog/categories` projects the same cached snapshot into only nonempty categories:

```json
{
  "categories": [
    {
      "id": "example-category-id",
      "name": "Drinks",
      "item_count": 2
    }
  ]
}
```

Missing `location_id` returns a clean 400 required-field error. Duplicate values return a clean 400 exactly-once error. Empty, padded, longer-than-32-character, or non-alphanumeric values return a clean 400 invalid-field error. A well-formed ID that is not in Square's current active location list returns clean 404 without searching the catalog. Successes and errors are JSON, `Cache-Control: no-store`, and correlated by `x-request-id`; public payloads never include raw Square errors.

The cache reduces Square traffic but does not make browser responses cacheable. On a cache miss, the service lists active locations, retrieves every catalog page, maps the full result, and stores only successful output. Catalog and categories requests for the same location share both completed entries and concurrent work. Cache hits intentionally skip active-location revalidation until expiry, so deactivation or menu changes can remain visible for at most the remaining TTL.

## Locations endpoint

`GET /api/locations` calls Square's List Locations API on demand and returns only active locations:

```json
{
  "locations": [
    {
      "id": "example-location-id",
      "name": "Example cafe",
      "address": null,
      "timezone": null,
      "businessHours": null,
      "status": "ACTIVE"
    }
  ]
}
```

When present, `address` is a structured object with nullable address lines, locality, sublocality, administrative districts, postal code, and country. `businessHours`, when present, is a read-only array of `{ dayOfWeek, startLocalTime, endLocalTime }` periods mapped from Square's `businessHours.periods`; invalid periods are skipped and the field is `null` when none remain. The client trust-boundary validator covers the new field, and the pure `getOpenStatus()` util derives the open/closed pill from it. Both successful and error responses use `Cache-Control: no-store` and an `x-request-id` header. Errors use the typed public envelope and never forward raw Square details. An empty or entirely inactive Square response returns `{ "locations": [] }`; malformed active records fail the whole response rather than publishing incomplete identities.

### Dependency decisions

- `square@45.0.1` is the required official typed server SDK. It avoids hand-writing Square authentication and transport shapes, while the factory prevents SDK details from spreading into UI code. Its transitive dependencies increase the server install footprint, but it is never imported by client components.
- `server-only@0.0.1` is a tiny build-time boundary marker that makes accidental client imports fail. A comment or naming convention cannot enforce that boundary. Tests replace the marker with an inert mock because they execute outside Next.js.

Square's official guidance confirms that backend clients are initialized with an access token and target environment, Sandbox and production credentials are not interchangeable, and omitted CatalogObject availability defaults to all locations with explicit include/exclude exceptions: [Node.js SDK migration guide](https://developer.squareup.com/docs/sdks/nodejs/migration), [access-token guidance](https://developer.squareup.com/docs/build-basics/access-tokens), [API versioning](https://developer.squareup.com/docs/build-basics/versioning-overview), and [CatalogObject availability](https://developer.squareup.com/reference/square/objects/CatalogObject).

## Documentation

- The authoritative requirements remain in `Full Stack Coding Challenge - Feb 2026.md`.
- The standalone architecture, traceability, testing, and interview guide is `docs/learning-guide.html`.
- The standalone interactive Square Catalog companion is `docs/catalog-learning-lab.html`. Its availability simulator mirrors the Phase 5 true/omitted-versus-false policy and uses only embedded, non-secret example data.

## Current assumptions and limitations

- The repository filename says February 2026 while the supplied document heading says February 2025; the supplied contents remain the functional source of truth.
- The current page supports location selection, a live open/closed business-hours pill, client-side menu search, per-item favorites, light/dark theming, concurrent catalog/category loading, resilient skeleton/error/empty states, retry focus recovery, keyboard category navigation, reduced-motion behavior, responsive menu cards with lowest-price summaries, category icons and counts, and accessible long-description disclosure. The decorative filter/bell buttons, the connection-status pill, the fixed bottom navigation, and the Orders destination were removed. About and item detail remain the only deferred, non-interactive placeholders.
- The UI uses the Nunito font loaded through `next/font/google`, so the first production build fetches the font over the network; subsequent builds reuse the cached font. Open/closed status is computed purely from Square business hours in the location timezone with no added date dependency, and is `unknown` (the pill renders nothing) when hours or the timezone are missing or invalid.
- Local credential values were never opened, modified, logged, or documented. Deterministic tests use fake data. Phase 3 and Phase 6 production smokes let the server consume configured Sandbox values only through the normal lazy runtime path; the checks emitted only HTTP status, aggregate counts, and contract booleans, never seller fields or credentials.
- Configuration is intentionally validated lazily rather than during the production build; a runtime request that reaches a Square gateway fails with a sanitized configuration error when values are invalid.
- The SDK's installed `SquareClient.Options` type allows only its bundled `version` literal. The project therefore relies on the exact `square@45.0.1` pin instead of inventing a separate unsupported Square API header override.
- Catalog results use a five-minute process-local cache keyed by location. Cache state is lost on restart and is not shared across serverless functions, processes, regions, or horizontally scaled instances; production scale should use a shared store such as Redis plus event-driven invalidation.
- The endpoint is explicitly `force-dynamic` on the Node.js runtime. Its process and deployment still require valid server environment variables when the request reaches Square.
- `GET /api/locations`, `GET /api/catalog`, and `GET /api/catalog/categories` exist publicly. The frontend validates all three contracts, persists only active locations, aborts stale endpoint pairs, guards against late results, reconciles category projections, and renders the grouped menu. Search and later product interactions remain deferred.
- Bonus search, favorites, dark mode, and Docker support are implemented (see the Docker section above); webhooks and hosted deployment are intentionally deferred. Architecture trade-offs and durable desktop/mobile screenshots are documented above and verified by the production E2E suite.

## Submission status

- README setup/run instructions, architecture decisions, trade-offs, assumptions, limitations, test taxonomy, and screenshots are complete.
- Durable production screenshots are stored under `docs/screenshots/` and regenerated by E2E.
- Bonus search, favorites, dark mode, and Docker support are implemented; webhooks and hosted deployment are intentionally not implemented.
- Pushing the repository to GitHub and sharing its URL is the remaining user-owned submission action; this repository does not commit or push automatically.
