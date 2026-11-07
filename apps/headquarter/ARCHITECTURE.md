# Headquarter Architecture

**Status:** Structural foundation, API boundary, and visual token foundation  
**Scope:** `apps/headquarter`  
**Last reviewed:** 2026-11-07

## Responsibility

Headquarter is the human-facing Next.js App Router application. It owns page composition, browser interaction, presentation state, and API consumption. ARSY owns backend HTTP APIs and orchestration. Headquarter must not import Fastify internals, database/ORM implementation, database drivers, or privileged credentials.

Reusable React primitives and shared visual tokens belong to `packages/ui`. Headquarter may compose those primitives into shell and domain experiences, but should not fork shared primitives.

## Current source layout

```text
apps/headquarter/
  src/
    app/                 # Next.js routes, layouts, global stylesheet
    components/          # compatibility location for AppShell export
    shell/               # application-wide navigation and shell composition
      navigation.ts      # one IA registry with route and availability metadata
      sidebar.tsx        # responsive primary navigation
      topbar.tsx         # global actions and workspace context presentation
      command-palette.tsx
    features/            # domain-owned modules and read models
      arsy-deck/         # reference feature: types, repository, demo fixture, view
      decision-graph/    # Phase 7: decision/evidence provenance graph and pure assessor
      scenario-forge/    # Phase 8: deterministic shadow-only scenario kernel
    platform/            # cross-feature integrations
      arsy/              # public ARSY HTTP client and frontend-safe contracts
```

The `features` and `platform` areas are ownership conventions, not a requirement to create empty folders or speculative abstractions. Keep a route page self-contained while it is small. Extract a feature module when it has domain-specific components, state, API adapters, or tests that need independent ownership.

## Dependency direction

- App Router pages compose shell and feature experiences.
- Shell may use `packages/ui` primitives and navigation metadata.
- Features may consume platform services and shared UI primitives.
- Platform adapters may expose public API contracts to features.
- No Headquarter module may import private ARSY server code or persistence internals.
- `packages/ui` must remain independent of Headquarter business domains.

## Routing and locale

Existing route URLs are preserved. Locale routing under `/id` and `/en` is not enabled yet; the current EN/ID switch is local prototype presentation state, not a persisted or route-aware locale implementation. Do not claim localization is complete until routing, message catalogs, formatting, and preference behavior are integrated.

## Shell contract

- `AppShell` composes the global shell and owns only global presentation state.
- `navigation.ts` is the single source for navigation labels, route paths, and groups.
- `Sidebar` owns active-route presentation and responsive navigation.
- `Topbar` receives state and callbacks; it does not own feature business logic.
- `CommandPalette` filters the navigation registry and supports Escape, backdrop dismissal, labelled search, dialog semantics, focus restoration, and keyboard focus containment. Browser-level verification is still required.
- Prototype-only notification, locale, and theme controls must remain explicitly labelled until connected to real platform capabilities.

## ARSY API boundary

The frontend-safe adapter lives in `src/platform/arsy`. It targets the versioned public API prefix (`/api/v1` by default) or `NEXT_PUBLIC_ARSY_API_BASE_URL` when configured. It adds a request ID, uses cookie-based credentials, supports cancellation and timeouts, disables implicit response caching, and retries transient failures only for GET requests. It does not import ARSY internals or store bearer tokens.

The adapter is transport infrastructure, not proof that a backend capability exists. Login, session renewal, permission evaluation, workspace selection, health, and feature endpoints must be wired only after ARSY publishes the corresponding contract. ARSY remains the authorization enforcement point.

## Design-system contract

`packages/ui/src/styles/globals.css` owns semantic CSS variables for surfaces, content, focus, borders, and success/warning/info/destructive states. Night Riot and Paper Riot theme values map to the same semantic names. `packages/ui/tailwind.config.js` exposes those semantic tokens and the stable brand palette. Feature pages should prefer semantic tokens for state and layout; brand colors remain intentional accents.

## Route lifecycle

The App Router root now provides route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` fallbacks. Error UI intentionally avoids rendering raw exception messages. These boundaries are baseline recovery UX; they do not replace feature-specific empty, forbidden, stale, or partial-data states.

## Feature implementation pattern

ARSY DECK is the reference feature. Its App Router page is a thin composition layer. Domain types, repository selection, explicit demo fixtures, and feature view are owned by `src/features/arsy-deck`.

The current ARSY app exposes a root status response and a database health route only. It does not publish the workspace-pulse contract required by ARSY DECK. The feature therefore uses a visibly disclosed demo repository and intentionally exposes no mutation controls. Do not add a guessed endpoint or infer connected/healthy states from sample data.

## Navigation and rollout

`shell/navigation.ts` follows the approved product information architecture and records each entry as `prototype` or `planned`. Existing prototype routes remain navigable and visibly marked. Administration capabilities without a real route are disabled roadmap entries, not links to placeholder pages. This is presentation metadata only; ARSY must enforce all authorization.

See `FEATURE-ROLLOUT.md` for ownership, production gates, and administration readiness.

## Current known limitations

- Feature pages still contain local/static demo data. ARSY DECK now has a domain-owned repository boundary and explicit fixture; no production feature endpoint is connected.
- Authentication, authorization, workspace persistence, and locale routing are not implemented because their authoritative ARSY contracts are not yet verified.
- Administration is aligned with the approved IA at the navigation/roadmap level only; planned entries remain disabled until routes, contracts, and authorization exist.
- Browser-level responsive, keyboard, screen-reader, contrast, and theme verification remains a release task.
- PR #35 was merged to `main` as `51bfe984cde513f5190ab192491681fe41f96aab`. Repository integrity CI passed (lockfile sync, dependency install, workspace type-check, lint/validation); Asset Integrity passed (asset/UI/Headquarter type-check, Headquarter production build, SVG checks, and asset registry tests). CodeQL passed. Browser-level accessibility and visual regression remain unverified.


## Decision Graph and Scenario Forge

Phase 7 adds a pure Decision Graph assessor for traceability, provenance, evidence validity, and broken graph references. It models the "why-chain" behind decisions; it is not a substitute for ARSY's append-only audit log or authorization.

Phase 8 adds a pure Scenario Forge calculation kernel. It evaluates explicit operations against an immutable baseline and returns `shadow-only` results. It cannot call APIs, persist state, or execute production changes.

Both modules are domain foundations only. Their UI, persistence, read-only ARSY snapshot contracts, workspace scope, and production approval paths remain gated on platform design.


## Phase 9–10 operator surfaces

- `/decision-graph` composes the Decision Graph Explorer from the domain-owned synthetic fixture and pure integrity assessor. It surfaces traceability, contradiction links, stale evidence, and Decision Debt without claiming live provenance.
- `/scenario-forge` composes the Scenario Arena. It compares explicit scenarios against one immutable fixture and ranks absolute metric deltas as a descriptive sensitivity lens, not causal attribution.
- Both routes are marked prototype in navigation. They have no ARSY endpoint, persistence, or production write path. See `PHASE-9-10-RESEARCH.md` for research signals and validation hypotheses.


## Phase 11–13 governance kernel

- `features/replay-capsule` canonicalizes scenario inputs/results and computes a SHA-256 content digest. Verification checks digest integrity and deterministic recomputation. It does not authenticate a signer or trusted time.
- `features/decision-debt` compiles missing/stale/contradictory decision rationale and traverses downstream `causes` links into a review backlog. Scores prioritize attention; they are not probabilities.
- `features/uncertainty-gate` validates low/base/high ranges, source quality, evidence coverage, stale evidence, contradictions, and unresolved assumptions. It can block or route to human review; it never approves.
- `/governance-lab` presents these engines with synthetic fixtures. No live ARSY integration, persistence, or production mutation path exists.


## Phase 14–16 Sentinel Fabric

Three additional pure domain kernels live under `features/belief-drift`, `features/blast-radius`, and `features/evidence-expiry`. They compare versioned belief snapshots, traverse explicit causal edges, and calculate evidence freshness budgets. These are deterministic review aids only: they do not infer causal truth, renew evidence, authorize actions, persist state, or connect to ARSY. See `PHASE-14-16-SENTINEL-FABRIC.md` and `PHASE-14-16-RESEARCH.md`.


## Money Maker integration boundary

The Money Maker development vertical slice lives in `src/features/money-maker`. Headquarter owns only browser interaction and presentation; all commercial records and authorization decisions remain in ARSY.

- `/riot-radar` captures evidence-backed opportunities and reads persisted opportunity records.
- `/the-forge` promotes only an opportunity with a complete score of at least 80 and all four hard gates passed into a product brief, and creates append-only revisions.
- `/mizan-ledger` records exact integer minor-unit financial events, keeps them pending until evidence-backed reconciliation, and reads currency-grouped verified totals.
- `/aftershock` shows persisted opportunity/product counts and reconciled contribution; conversion and lifetime metrics remain unavailable without defined cohorts and source events.
- `/signal-room` and `/sidra-archive` show truthful disconnected states until source connectors and binary asset storage are implemented.

Headquarter server-side BFF routes use `src/lib/arsy-proxy` and the signed operator session in `src/lib/operator-session`. Never expose `ARSY_OPERATOR_TOKEN` to browser code. Mutating requests require the configured same-origin check. The session is a single-owner bootstrap only; it is not a substitute for multi-user RBAC or tenant isolation.

The opportunity/product/inspection/channel/listing/finance APIs are covered by ARSY unit, route-injection, and isolated PostgreSQL integration tests. Browser E2E, production operations, asset binary storage, official marketplace APIs, and cohort analytics remain release gates.
