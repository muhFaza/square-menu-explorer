# AGENTS.md

Orientation for anyone reading this repository for the first time, human or agent.
Everything here is checkable — where it makes a claim, it names the command or file that proves it.

## What this is

Square Menu Explorer, built for the Per Diem full-stack coding challenge. It is a
mobile-first menu browser that reads live catalog and location data from Square
through server-side Next.js Route Handlers, so the access token never reaches the
browser.

The brief this was built against is committed at
`Full Stack Coding Challenge - Feb 2026.md`. Read it first if you are assessing
whether the implementation meets the requirements; `REQUIREMENTS.md` maps each
one to the code and the test that covers it.

Live instance: <https://square.muhammadfaza.com>

## Running it

```bash
pnpm install
pnpm test          # 274 tests, no credentials required
```

The full test suite is deterministic and uses fabricated data, so it runs on a
fresh clone with no Square account and no `.env` file. This is the fastest way to
confirm the project works.

Running the **application** does require Square Sandbox credentials, because it
proxies live Square APIs:

```bash
cp .env.example .env.local   # fill in SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT
pnpm dev                     # http://localhost:3000
```

`node scripts/seed-sandbox.mjs` populates a sandbox with three locations and a
menu built to exercise every Square availability mechanism. The README documents
exactly what it produces.

If you have no Square account, use the live instance above.

## Verifying claims

| Command | What it proves |
| --- | --- |
| `pnpm test` | Square semantics, money precision, caching, mapping, HTTP contracts, React state and accessible interactions |
| `pnpm lint:fix` | ESLint clean, then a strict `tsc --noEmit` pass |
| `pnpm build` | Production build succeeds |
| `pnpm test:e2e` | Builds, then drives the real app in Chromium at 1440px and exactly 375px |
| `pnpm verify` | All of the above with a single build |

`pnpm start` and the E2E suite both run `.next/standalone/server.js` — the same
entrypoint the Docker image uses — so tests exercise the artifact that actually
ships rather than a development server.

## Where things live

```
src/app/api/            Route Handlers: locations, catalog, catalog/categories, webhooks/square
src/lib/square/         Square SDK gateways and error translation (server-only)
src/lib/catalog/        Catalog service, pure mapper, and the per-location cache
src/lib/locations/      Location service and mapper
src/lib/http/           Shared JSON responses, error envelope, location_id validation
src/lib/logging/        Request logging: method, path, status, duration
src/lib/webhooks/       Webhook signature verification
src/lib/client/         Browser-side helpers: response validators, money, open/closed status
src/components/         React components, each with a colocated .test.tsx
src/hooks/              Location selection, menu loading, favorites, theme
e2e/                    Playwright specs
scripts/                Sandbox seeding, standalone server preparation
```

Every module that talks to Square imports `server-only`, so an accidental client
import fails the build rather than leaking the token.

## Design decisions worth knowing

- **Pure mapper, explicit layers.** Route → service → cache → gateway → mapper.
  Availability rules, money handling, and error translation are each testable in
  isolation, which is why the unit suite covers Square semantics without network access.
- **Full pagination before mapping.** A partial menu can never render; a late-page
  failure rejects the whole request instead.
- **One five-minute cache per location,** shared by both catalog endpoints, with
  webhook-driven invalidation on `catalog.version.updated` so changes do not wait
  out the TTL.
- **Money stays in integer minor units** and is compared and formatted with
  `BigInt`, preserving values beyond `Number.MAX_SAFE_INTEGER` and currency-specific precision.
- **Race guard on location changes.** A switch aborts both in-flight requests and
  increments a sequence counter, so a slow earlier response cannot overwrite a newer menu.
- **Both endpoint responses cross strict runtime validators** before React sees
  them; a mismatched pair fails as one error rather than rendering contradictory navigation.
- **Accessibility is load-bearing, not decorative.** ARIA APG combobox for the
  location picker, roving tabindex for category navigation, a focus-trapped
  drawer, live-region announcements, focus recovery after retries, and full
  `prefers-reduced-motion` support. Lighthouse accessibility scores 100 on both
  mobile and desktop.

## Conventions if you change something

- Use `pnpm`. The repository pins `pnpm@10.14.0`.
- Run `pnpm lint:fix` for lint and type checking, and `pnpm verify` before
  claiming a behavior change is complete.
- Put a test at the layer that owns the behavior: pure logic in unit tests, HTTP
  contracts in route tests, interaction in component tests, and only genuinely
  cross-cutting flows in E2E.
- Comments explain *why*, not what the syntax already says. Match the density and
  tone of the surrounding file.
- Prefer explicit types and small pure functions over broad `any` and premature abstraction.
- Never commit credentials. `.env.example` carries placeholder values only.
