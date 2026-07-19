# AGENTS.md

## Purpose

This repository contains the completed Per Diem Square Menu Explorer coding challenge: a responsive Next.js application that securely proxies Square Locations and Catalog data, normalizes catalog relationships, and presents location-aware menu categories and items.

Treat the application as a finished mandatory-requirements baseline. Make focused maintenance or feature changes without reopening the original phased-build workflow.

## Source-of-truth order

Use this priority when instructions or documentation disagree:

1. The user's latest explicit instruction
2. `Full Stack Coding Challenge - Feb 2026.md`
3. This `AGENTS.md`
4. `docs/learning-guide.html`
5. Existing source and test conventions

The challenge file must remain in the repository root. Do not modify, rename, move, or delete it unless the user explicitly requests that change.

The original phase-by-phase build instructions are archived at `docs/AGENTS-phased-build.md`. They are historical context, not active workflow requirements.

## Start of a task

Before changing code:

1. Read the relevant challenge section.
2. Inspect the affected source, tests, and corresponding learning-guide entries.
3. Check the available package scripts instead of assuming command names.
4. State the intended scope and any meaningful behavior or architecture trade-off.
5. Check for existing uncommitted work and preserve unrelated user changes.

For small, well-bounded maintenance work, a concise plan is enough. Do not recreate phase dashboards or phase-boundary ceremonies unless the user explicitly asks for phased work.

## Commands and tooling

- Use `pnpm`; do not use `npm` or `yarn`.
- Use `pnpm lint:fix` for lint fixing and TypeScript checking.
- Do not run `pnpm run dev`. Use a production build and the built server when browser verification is needed.
- Use `pnpm verify` for the complete repository gate.
- Build fresh before running Playwright against the production app.
- Use the actual scripts in `package.json` when a narrower check is appropriate.
- GitHub CLI is available at `C:/Program Files/GitHub CLI/gh.exe`.

Expected verification layers are:

- unit tests for pure mapping, money, availability, cache, and error behavior;
- integration tests for route handlers and service-to-Square boundaries;
- component tests for client state and accessible interactions;
- Playwright E2E tests for critical responsive user flows;
- a production build for framework and server-boundary validation.

## Architecture guardrails

Preserve the existing responsibility boundaries:

- Route handlers validate HTTP input, call services, and map known failures to the public API error shape.
- Services coordinate Square requests, pagination, mapping, availability, and caching.
- Square modules configure authentication and environment access on the server only.
- Mapper and availability modules remain pure and independently testable.
- Client API modules validate normalized route responses.
- React hooks own request lifecycle, aborts, stale-response protection, and browser persistence.
- Components focus on presentation, interaction, accessibility, and responsive behavior.

Do not add a database for core menu data. Square remains the source of truth. Do not replace the explicit in-memory cache with external infrastructure unless the user approves the operational trade-off.

## Square correctness

Maintain these behaviors when touching catalog code:

- request catalog items with related objects;
- follow every pagination cursor and fail the whole retrieval if a later page fails;
- join categories and images by catalog object ID rather than assuming they are embedded;
- account for `present_at_all_locations`, `present_at_location_ids`, and `absent_at_location_ids` at item and variation level;
- preserve Square money as integer amount plus currency code until presentation formatting;
- retain the deliberate `Uncategorized` fallback for items without a resolved category relationship;
- keep cache keys location-specific and expiration deterministic;
- keep the Square SDK and Square API contract intentionally pinned rather than accepting an implicit version drift.

Changes to these rules require focused tests and an explanation in `docs/learning-guide.html`.

Before changing the Square SDK version or pinned API contract, review the relevant official migration notes, explain the compatibility impact, update the lockfile intentionally, run the Square integration and full verification gates, and record the decision in the learning guide.

## Security and environment files

The Square access token must never enter client code, public environment variables, responses, logs, screenshots, tests, or documentation.

Do not open, print, or modify `.env`, `.env.local`, or any other credential-bearing file unless the user explicitly requests it. Use `.env.example` for documented configuration names and placeholders.

Keep secret-bearing modules server-only. Return sanitized application errors rather than raw Square SDK errors.

## UI and accessibility

The supplied design references are:

- `docs/DekstopUI.png`
- `docs/MobileUI.png`

Preserve the warm ivory/espresso visual system, compact menu density, three-column desktop layout, image-left mobile cards, category navigation, and fixed mobile navigation. The application must remain usable without horizontal overflow at 375px.

Maintain loading, retry, empty, image-fallback, missing-price, and missing-description states. Preserve keyboard navigation, visible focus, reduced-motion behavior, useful live announcements, and focus recovery after retries.

Search, favorites, orders, About, item-detail screens, dark mode, Docker, webhooks, and deployment are optional or deferred unless the user explicitly brings them into scope. Do not make inactive reference controls appear functional.

## Code and dependency policy

Use explicit, readable TypeScript and follow nearby patterns. Prefer focused functions, pure transformations, descriptive types, and clear control flow.

Avoid broad `any`, unrelated rewrites, premature abstractions, duplicate helpers, dead code, and comments that merely restate syntax.

Before adding a package, explain:

- the problem it solves;
- where it will be used;
- why the platform or existing dependencies are insufficient;
- bundle, maintenance, and security implications;
- alternatives considered.

## Documentation

`docs/learning-guide.html` is a required living artifact. Update it whenever behavior, architecture, public types, important functions, test coverage, setup instructions, or known limitations change.

Keep its file paths, exported names, approximate line ranges, verification evidence, traceability, decisions, and change history synchronized with the implementation. Do not add secrets or raw seller identifiers.

Update `README.md` when setup, scripts, screenshots, architecture trade-offs, assumptions, limitations, or submission status changes.

Pure formatting or test-only maintenance does not require rewriting historical phase records; add a concise current change-history entry when documentation impact is meaningful.

## Verification and completion

Run checks proportionate to risk. For application behavior or architecture changes, run `pnpm verify` unless a documented environment blocker prevents it. For narrow documentation-only work, validate links, fragments, paths, and formatting without claiming application verification that was not run.

Before handing work back:

1. Confirm the implementation matches the relevant challenge requirement.
2. Confirm tests exercise the changed behavior at the correct layer.
3. Refresh affected learning-guide references and evidence.
4. Check that no secret or credential value appears in changed files or output.
5. Report commands actually run, results, limitations, and deferred work.

Do not reveal interview-question model answers until the user explicitly requests interview practice.

## Git and destructive-operation safety

- Never commit or push unless explicitly instructed.
- Check `git status` before any Git operation; do not assume the worktree is clean.
- Never switch branches, checkout, stash, or edit the main checkout when the user has asked for isolated worktree changes.
- Never create, close, reopen, or modify a GitHub Issue or pull request without explicit instruction. Merging a pull request also requires explicit instruction.
- Always ask before any push or operation targeting `main` or `master`.
- Never run force-push, hard reset, shared-branch rebase, branch deletion, destructive database operations, recursive deletion, or credential-file modification without explicit authorization.
- Do not commit generated secrets, local environment files, test output, or transient server artifacts.
