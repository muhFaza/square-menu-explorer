# Requirements traceability

Every requirement from `Full Stack Coding Challenge - Feb 2026.md`, mapped to the
code that implements it and the test that covers it. Run `pnpm test` to execute
every test referenced here; none of them need Square credentials.

## 1. Backend — Square API proxy

| Requirement | Implementation | Test |
| --- | --- | --- |
| Access token never exposed to the frontend | `src/lib/square/client.ts`, every Square module imports `server-only` | `src/lib/square/client.test.ts` |
| `GET /api/locations` returns `id`, `name`, `address`, `timezone`, `status` | `src/app/api/locations/route.ts`, `src/lib/locations/location-mapper.ts` | `src/app/api/locations/route.test.ts`, `src/lib/locations/location-mapper.test.ts` |
| Only `ACTIVE` locations returned | `src/lib/locations/location-service.ts` | `src/lib/locations/location-mapper.test.ts` |
| `SearchCatalogObjects` with `object_types: ["ITEM"]` and `include_related_objects: true` | `src/lib/square/catalog-gateway.ts` | `src/lib/square/catalog-gateway.test.ts` |
| Filter items by `present_at_location_ids` / `present_at_all_locations` | `src/lib/catalog/catalog-mapper.ts` | `src/lib/catalog/catalog-mapper.test.ts` |
| Response grouped by category name | `src/lib/catalog/catalog-mapper.ts` | `src/lib/catalog/catalog-mapper.test.ts` |
| Item fields: `id`, `name`, `description`, `category`, `image_url`, `variations` | `src/lib/catalog/catalog-mapper.ts`, `src/types/api.ts` | `src/lib/catalog/catalog-mapper.test.ts` |
| `GET /api/catalog/categories` returns only non-empty categories with `item_count` | `src/app/api/catalog/categories/route.ts`, `src/lib/catalog/catalog-service.ts` | `src/app/api/catalog/route.test.ts`, `src/lib/catalog/catalog-service.test.ts` |
| All responses typed | `src/types/api.ts` | `pnpm lint:fix` runs `tsc --noEmit` |
| Square errors mapped to a clean envelope, never passed through | `src/lib/square/square-error.ts`, `src/lib/http/api-error.ts` | `src/lib/square/square-error.test.ts`, `src/lib/http/api-error.test.ts` |
| In-memory cache with a reasonable TTL | `src/lib/catalog/catalog-cache.ts` (5 minutes, per location) | `src/lib/catalog/catalog-cache.test.ts` |
| Pagination handled transparently via `cursor` | `src/lib/square/catalog-gateway.ts` | `src/lib/square/catalog-gateway.test.ts` |
| Request logging: method, path, status, duration | `src/lib/logging/request-logger.ts` | `src/lib/logging/request-logger.test.ts` |

## 2. Frontend — menu display

| Requirement | Implementation | Test |
| --- | --- | --- |
| Fetch locations on load, show a selector | `src/hooks/use-location-selection.ts`, `src/components/location-selector.tsx` | `src/components/location-selector.test.tsx` |
| Persist selection in `localStorage` across refresh | `src/hooks/use-location-selection.ts` | `src/components/menu-explorer-shell.test.tsx` |
| Category navigation with active highlighting | `src/components/category-navigation.tsx` | `src/components/category-navigation.test.tsx` |
| Clicking a category scrolls to that section | `src/components/menu-catalog-view.tsx` | `src/components/menu-catalog-view.test.tsx`, `e2e/menu-explorer.spec.ts` |
| Items displayed grouped by category | `src/components/menu-catalog-view.tsx` | `src/components/menu-catalog-view.test.tsx` |
| Card shows name, description, image, price, variations | `src/components/menu-item-card.tsx` | `src/components/menu-item-card.test.tsx` |
| Long descriptions truncated with a "Read more" expand | `src/components/menu-item-card.tsx` | `src/components/menu-item-card.test.tsx`, `e2e/menu-explorer.spec.ts` |
| Tasteful placeholder when an image is missing | `src/components/menu-item-card.tsx` | `src/components/menu-item-card.test.tsx` |
| Price formatted as currency | `src/lib/client/money.ts` (`BigInt` + `Intl.NumberFormat`) | `src/lib/client/money.test.ts` |
| Multiple variations shown | `src/components/menu-item-card.tsx` | `src/components/menu-item-card.test.tsx` |
| Mobile-first, correct at 375px | `src/app/globals.css` | `e2e/menu-explorer.spec.ts` runs a dedicated 375px project |
| Loading skeletons while fetching | `src/components/menu-loading-skeleton.tsx` | `src/components/menu-explorer-shell.test.tsx`, `e2e/menu-explorer.spec.ts` |
| Error states with a retry button | `src/components/menu-explorer-shell.tsx` | `src/components/menu-explorer-shell.test.tsx`, `e2e/menu-explorer.spec.ts` |
| Empty states | `src/components/menu-catalog-view.tsx` | `src/components/menu-explorer-shell.test.tsx`, `e2e/menu-explorer.spec.ts` |
| Smooth transitions when switching locations or categories | `src/app/globals.css`, `src/components/menu-catalog-view.tsx` | `src/components/menu-catalog-view.test.tsx` |

## 3. Search (bonus)

| Requirement | Implementation | Test |
| --- | --- | --- |
| Client-side filter by name or description | `src/components/search-bar.tsx`, `src/components/menu-explorer-shell.tsx` | `src/components/search-bar.test.tsx`, `e2e/menu-explorer.spec.ts` |

## 4. Testing

The brief asks for a demonstrated understanding of unit, integration, and E2E tests.

| Level | Real boundary | Controlled boundary | Example |
| --- | --- | --- | --- |
| Unit | Pure mapping, money, availability, cache, error, config logic | Fabricated SDK-shaped values and clocks | `src/lib/catalog/catalog-mapper.test.ts` |
| Integration | Route → logging → service → cache → gateway → mapper | Only the Square SDK client and time/ID effects | `src/app/api/catalog/route.test.ts` |
| Component | Real React hooks and components in jsdom | `fetch`, storage, observers, layout measurement | `src/components/menu-explorer-shell.test.tsx` |
| End-to-end | The built standalone app in Chromium, desktop and 375px | Public HTTP responses intercepted; no credentials used | `e2e/menu-explorer.spec.ts` |

## 5. Environment and configuration

| Requirement | Implementation |
| --- | --- |
| `.env.example` committed with `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT`, `PORT` | `.env.example` |
| Validated configuration | `src/lib/config/env.ts`, tested in `src/lib/config/env.test.ts` |
| Starts with a single command | `pnpm dev` |
| `docker-compose.yml` for containerization | `docker-compose.yml`, `Dockerfile` |

## Bonus items

| Bonus | Status |
| --- | --- |
| In-memory caching with a reasonable TTL | Implemented — 5 minutes, per location |
| Pagination handling | Implemented |
| Request logging | Implemented |
| Search / filter bar | Implemented |
| Docker support (`docker compose up`) | Implemented |
| Server-side caching **with cache invalidation** | Implemented — Square webhook on `catalog.version.updated`, HMAC-verified |
| Deploy to a live URL | Implemented — <https://square.muhammadfaza.com> |

## Deliberate deviations

Two places where the implementation does something other than the literal wording
of the brief, both on purpose:

1. **Price shown is the lowest variation price, not the first.** The brief says
   "price (from the first variation)". Square does not guarantee variation order,
   so the first variation can be an arbitrary one and the displayed price would
   change between requests. The card shows `From $X.XX` using the lowest price
   found by `BigInt` comparison, and the exact price when only one variation
   exists. See `src/lib/client/money.ts`.

2. **Categories come from a second CATEGORY search pass.** The brief's tip says
   `include_related_objects: true` returns the `CatalogCategory` objects to join
   by ID. In the current API version it returns referenced `IMAGE` objects but not
   the categories behind `item_data.categories[]`, so `src/lib/square/catalog-gateway.ts`
   runs a second CATEGORY pass to resolve names. Without it, every item would fall
   back to `Uncategorized`.
