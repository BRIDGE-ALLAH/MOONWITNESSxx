# Technical Specification: Gate UI & Universe Components

## 1. Functional Requirements

- **REQ-001 (StatusIndicator):** Provide a visual indicator for system states (`active`, `target`, `degraded`, `offline`) featuring pulse animation for live states and strict color tokens matching MOONWITNESS design DNA.
- **REQ-002 (UniverseCard):** Render domain/experience information (title, classification, role description, current status, domain boundary indicator) using `@riotworks/ui` primitives.
- **REQ-003 (GateNavbar):** Provide a top-level header component with MOONWITNESS identity branding, experience number indicator (`01 / 09`), and quick links.
- **REQ-004 (UniverseGrid):** Responsive grid (1 col on mobile, 2 cols on tablet, 3 cols on desktop) organizing the 9 target experiences defined in `docs/32-universe-and-product-architecture-registry.md`.

## 2. Component Contract Specification

### `StatusIndicator`
- **Props:**
  - `status: 'active' | 'target' | 'degraded' | 'offline'`
  - `label?: string`
  - `pulse?: boolean`
  - `size?: 'sm' | 'md'`

### `UniverseCard`
- **Props:**
  - `id: string`
  - `title: string`
  - `role: string`
  - `status: 'active' | 'target' | 'degraded' | 'offline'`
  - `statusLabel: string`
  - `href?: string`
  - `domainBoundary?: string`

## 3. Acceptance Criteria
- Unit test passing in `apps/gate/tests/components.test.mjs`.
- Type checking passes with zero errors (`pnpm --filter @riotworks/gate type-check`).
- Zero merge conflict against active PRs.

