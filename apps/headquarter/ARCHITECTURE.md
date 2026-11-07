# Headquarter Architecture

**Status:** Initial application boundary and folder conventions  
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
    platform/            # cross-feature integrations only when implemented
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
- `CommandPalette` filters the navigation registry and supports Escape, backdrop dismissal, labelled search, dialog semantics, and focus restoration. A full focus trap still requires browser-level verification.
- Prototype-only notification, locale, and theme controls must remain explicitly labelled until connected to real platform capabilities.

## Current known limitations

- Feature pages still contain local/static demo data; no production API adapter is established.
- Authentication, authorization, workspace persistence, and locale routing are not implemented by this structural change.
- The administration navigation is incomplete relative to the approved information architecture; do not expose placeholder routes as working functionality.
- Browser-level responsive, keyboard, and screen-reader verification remains a release task.
