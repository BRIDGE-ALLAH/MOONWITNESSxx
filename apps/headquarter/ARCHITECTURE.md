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
      navigation.ts      # one source of truth for navigation metadata
      sidebar.tsx        # responsive primary navigation
      topbar.tsx         # global actions and workspace context presentation
      command-palette.tsx
    features/            # add domain-owned modules when extraction is justified
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

## Current known limitations

- Feature pages still contain local/static demo data; the API adapter is ready for integration but no feature endpoint has been connected.
- Authentication, authorization, workspace persistence, and locale routing are not implemented because their authoritative ARSY contracts are not yet verified.
- The administration navigation is incomplete relative to the approved information architecture; do not expose placeholder routes as working functionality.
- Browser-level responsive, keyboard, screen-reader, contrast, and theme verification remains a release task.
- Lint, type-check, tests, and production build have not been executed in this environment.
