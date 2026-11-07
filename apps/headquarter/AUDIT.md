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
| HQ-003 | High | Command palette has incomplete dialog semantics and dismissal behavior | Improved in Phase 1: labelled dialog, Escape/backdrop dismissal, and focus restoration; full focus trap not yet verified |
| HQ-004 | High | Lint script suppresses ESLint failures | Addressed in Phase 1 with a Next ESLint config and fail-fast command |
| HQ-005 | Medium | Home page describes architecture as `apps/headquarter + packages/ui` and says workspace active | Corrected in Phase 1 |
| HQ-006 | Medium | Route-aware locale and workspace persistence are absent | Deferred; requires platform decisions/integration |
| HQ-007 | Medium | Demo disclosure varies across pages | Deferred to feature rollout |
| HQ-008 | Medium | Duplicate list keys and invalid dynamic classes exist in static feature pages | Deferred to feature-specific quality fixes |
| HQ-009 | Medium | No local test runner or browser-level accessibility/responsive evidence is established for Headquarter | Not verified in this execution environment |

## Validation boundary

The GitHub repository interface used for this change can inspect and commit source files, but it cannot run the repository's local Node/pnpm commands or a browser. Therefore no claim is made that lint, type-check, Next build, responsive behavior, or keyboard/screen-reader tests pass. Those checks must run from a clean local checkout or CI before Phase 1 is considered fully released.

Recommended commands from repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @riotworks/headquarter lint
pnpm --filter @riotworks/headquarter type-check
pnpm --filter @riotworks/headquarter build
```
