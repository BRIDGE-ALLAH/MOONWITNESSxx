# Headquarter Phase 0 Audit

**Audit date:** 2026-11-07  
**Repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Audited branch:** `main`  
**Source snapshot:** commit `f0c8c0dad9f122d8c0f55adaad9ccadc2e97c92b` (before this Phase 0/1 implementation)

## Executive summary

Headquarter is a small Next.js App Router prototype, not yet an enterprise-ready command center. The current manifest already matches the Next.js source. The earlier repository audit in `docs/23` recorded a prior state in which the manifest was incorrectly configured as Fastify; that finding is stale for the current source snapshot.

The safest Phase 1 move is to preserve existing route URLs and extract the global shell into cohesive modules. A broad route-group or locale migration is deferred because it would change routing behavior without an established locale middleware or localization runtime.

## Inventory

### Routes

| Route | Source |
|---|---|
| `/` | `src/app/page.tsx` |
| `/arsy-deck` | `src/app/arsy-deck/page.tsx` |
| `/signal-room` | `src/app/signal-room/page.tsx` |
| `/riot-radar` | `src/app/riot-radar/page.tsx` |
| `/the-forge` | `src/app/the-forge/page.tsx` |
| `/zill-watch` | `src/app/zill-watch/page.tsx` |
| `/launch-bay` | `src/app/launch-bay/page.tsx` |
| `/sidra-archive` | `src/app/sidra-archive/page.tsx` |
| `/mizan-ledger` | `src/app/mizan-ledger/page.tsx` |
| `/aftershock` | `src/app/aftershock/page.tsx` |
| `/riot-engine` | `src/app/riot-engine/page.tsx` |
| `/settings-policy` | `src/app/settings-policy/page.tsx` |

There are 12 page routes including the root page, one root layout, one global stylesheet, and no route handlers, route-level loading boundaries, error boundaries, or not-found page in the audited app tree.

### Application shell

Before this change, `src/components/AppShell.tsx` combined navigation configuration, sidebar rendering, topbar actions, theme/locale state, command-palette filtering, notifications, keyboard shortcut registration, and mobile navigation in one client component.

The shell was coupled to local prototype state. The workspace label is static demo context. Locale toggling changes component-local state only. Notification messages are local prototype notices. No backend/API integration or authentication context is established.

### Package and styling integration

- `apps/headquarter/package.json` declares Next.js 15.1, React 19, React DOM, `next-themes`, and `@riotworks/ui`.
- `next.config.ts` transpiles `@riotworks/ui`.
- `tailwind.config.ts` consumes the shared UI Tailwind preset and scans Headquarter plus shared UI source.
- `src/app/globals.css` imports `@riotworks/ui/styles`.
- `packages/ui/src/index.ts` exports Badge, Button, Card family, Separator, and `cn`; it is still a small primitive library.

### Feature status inventory

| Module | Observed status | Evidence |
|---|---|---|
| ARSY DECK | Prototype | Hardcoded metrics, agent rows, channel states, activity and insights |
| SIGNAL ROOM | Prototype | Hardcoded trends, sources, category counts and evidence |
| RIOT RADAR | Prototype | Hardcoded opportunity records and recommendation labels |
| THE FORGE | Prototype | Hardcoded product briefs, asset names and tool provenance |
| ZILL WATCH | Prototype | Hardcoded inspection checks and product metadata |
| LAUNCH BAY | Prototype | Hardcoded channel capability and publication history |
| SIDRA ARCHIVE | Prototype | Hardcoded asset catalog and provenance metadata |
| MIZAN LEDGER | Prototype | Hardcoded financial rows and payout labels |
| AFTERSHOCK | Prototype | Hardcoded conversion and portfolio insight values |
| RIOT ENGINE | Prototype | Hardcoded agent state, task and budget labels |
| SETTINGS / POLICY | Prototype | Hardcoded workspace, eligibility and consent placeholders |

No module is evidenced as production-ready in this source snapshot. The five early modules that do not consistently show a demo banner should be corrected during the feature rollout; their static content must not be interpreted as live business data.

### Shared component and dependency inventory

- Shared UI exports currently include Badge, Button, Card family, Separator, and `cn`; no duplicate Headquarter primitive library was found.
- The shell import graph is acyclic at this scope: AppShell composes shell modules; Sidebar and CommandPalette consume navigation metadata; shell components consume `@riotworks/ui` primitives.
- No Headquarter-specific `process.env` reads or private credentials were found in the inspected application source/config. Runtime environment requirements are not yet defined.
- No app-local public asset directory or custom font file is present in the Headquarter tree. Theme fonts/tokens are inherited from the shared UI styling layer.

### Data and UX truth

- Feature pages use local constants and static example values; no live ARSY API adapter is present.
- Some pages explicitly mark demo content, but the demo disclosure is not consistently present across all module pages.
- There are no established authentication, authorization, persisted workspace, or route-aware locale flows.
- Lifecycle coverage is minimal: no shared loading, empty, error, forbidden, offline, stale, or partial-data patterns are established.
- The approved IA lists additional restricted administration destinations that are not implemented as routes; they must not be represented as operational modules.
- Static data includes duplicate React list keys in parts of SIGNAL ROOM and malformed dynamic Tailwind class strings in ARSY DECK and SIGNAL ROOM; these need focused feature-level fixes.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| HQ-001 | High | AppShell mixes unrelated shell responsibilities | Addressed in Phase 1 by extracting navigation, sidebar, topbar, and command palette modules |
| HQ-002 | High | Navigation metadata is embedded in shell rendering | Addressed in Phase 1 with one typed navigation registry |
| HQ-003 | High | Command palette has incomplete dialog semantics and dismissal behavior | Improved: labelled dialog, Escape/backdrop dismissal, focus restoration, and keyboard focus containment; manual browser verification remains pending |
| HQ-004 | High | Lint script suppresses ESLint failures | Addressed in Phase 1 with a Next ESLint config and fail-fast command |
| HQ-005 | Medium | Home page describes architecture as `apps/headquarter + packages/ui` and says workspace active | Corrected in Phase 1 |
| HQ-006 | Medium | Route-aware locale and workspace persistence are absent | Deferred; requires platform decisions/integration |
| HQ-007 | Medium | Demo disclosure varies across pages | ARSY DECK now has a persistent demo disclosure and navigation labels all current routes as prototype; remaining legacy module pages still need a consistent page-level disclosure pass |
| HQ-008 | Medium | Duplicate list keys and invalid dynamic classes exist in static feature pages | Deferred to feature-specific quality fixes |
| HQ-009 | Medium | No Headquarter-specific browser E2E or accessibility test suite | Repository CI now verifies workspace type-check/lint, Headquarter build, and asset registry tests; browser/screen-reader evidence remains open |

## Phase 2–5 execution update

PR [#35](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/35) was merged to `main` as `51bfe984cde513f5190ab192491681fe41f96aab`.

- Phase 2: browser-safe ARSY client boundary established. Authentication, workspace, permission, and feature contracts remain gated on backend implementation.
- Phase 3: semantic Night Riot/Paper Riot token foundation, shared Badge/Button mappings, and reduced-motion baseline added.
- Phase 4: ARSY DECK feature structure established with a replaceable repository interface and explicit synthetic demo fixture. No live workspace-pulse API exists yet, so this is a reference UI/data-boundary pattern, not a production end-to-end feature.
- Phase 5: navigation aligned to the approved IA. Existing prototype routes are marked DEMO; unimplemented administration capabilities are disabled and documented in `ADMINISTRATION-IA.md` and `FEATURE-ROLLOUT.md`.
- Repository baseline fixes: lockfile checker invocation, pnpm lockfile, native build-script allowlist, root type-check alias, ARSY Node/PostgreSQL type declarations, Fastify Zod compiler registration, pg pool option, and shared lint toolchain.

## CI evidence

For PR #35 head `ab15d1f163bdc4cc98388ac5b884f5cb551f9ebc`:
- Repository CI: passed — lockfile check, dependency installation, workspace TypeScript checks, and repository lint/validation.
- Asset Integrity: passed — asset, shared UI, and Headquarter TypeScript checks; Headquarter production build; source asset validation; asset registry tests.
- CodeQL: passed.

The separate full-workspace typecheck/build workflow was skipped by workflow configuration. The asset workflow built Headquarter successfully. No browser, screen-reader, visual regression, or feature API E2E verification is claimed.

## Remaining release gates

- Implement and approve ARSY identity/session, workspace, permission, and workspace-pulse contracts before live feature wiring.
- Migrate each static module to its domain-owned repository and real API contract; do not relabel synthetic values as production.
- Complete route-aware localization and workspace persistence.
- Verify focus containment, contrast, responsive behavior, theme behavior, and screen-reader announcements in a real browser.
- Add feature-level contract/unit/E2E tests once the backend contract and test harness are available.


## Phase 6 — Enterprise hardening progress

**Status:** initial automated test foundation added; release readiness is not yet achieved.

- Added native Node 24 tests for the ARSY browser client: safe request defaults, request ID propagation, GET-only transient retry, no mutation retry, non-JSON gateway error normalization, and timeout normalization.
- Added fixture invariants for ARSY DECK: explicit demo disclosure, unique IDs, bounded confidence, and sample-only agent states.
- Hardened the ARSY client URL boundary: absolute/protocol-relative URLs, backslashes, and literal or percent-encoded parent-directory segments are rejected before fetch; regression tests cover these cases.
- Wired the Headquarter test command into the Asset Integrity CI job without introducing a new test framework dependency.
- PR #38 head `431720caf3ecdfe7266971c6803922c1cd48a2e7`: Repository CI and CodeQL passed. The Headquarter API/fixture tests, asset/UI/Headquarter type-checks, production build, asset validation, and asset registry tests all passed. Full-workspace quality remains skipped because `FULL_QUALITY_CI` is not enabled.
- Browser E2E, keyboard/screen-reader audit, WCAG contrast verification, responsive checks, visual regression, performance budgets, dependency/license review, and ARSY contract tests remain open.
- Production promotion remains blocked on approved ARSY identity/session, workspace, permission, and feature API contracts.
