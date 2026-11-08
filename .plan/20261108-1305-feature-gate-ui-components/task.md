# Executable Checklist: Gate UI Components

- [x] **Task 1: Create StatusIndicator Component** `[S]`
  - Path: `apps/gate/src/components/StatusIndicator.tsx`
  - Implementation: Supports active (emerald with pulse), target (sky), degraded (amber), and offline (rose).
  - Acceptance: Clean typed props, accessible labels.

- [x] **Task 2: Create UniverseCard Component** `[M]`
  - Path: `apps/gate/src/components/UniverseCard.tsx`
  - Implementation: Renders card using `@riotworks/ui` Card primitive, status indicator, action link, and boundary description.
  - Acceptance: Responsive layout, matches MOONWITNESS design DNA.

- [x] **Task 3: Create GateNavbar Component** `[S]`
  - Path: `apps/gate/src/components/GateNavbar.tsx`
  - Implementation: Branding logo/text, subtitle, experience badge (`01 / 09`), external links.
  - Acceptance: Clean header with desktop and mobile responsiveness.

- [x] **Task 4: Integrate into Gate Home Page** `[M]`
  - Path: `apps/gate/src/app/page.tsx`
  - Implementation: Full list of 9 experiences from `docs/32-universe-and-product-architecture-registry.md` rendered via `UniverseCard`.
  - Acceptance: Clean, aesthetic landing experience.

- [x] **Task 5: Verification & Contract Tests** `[S]`
  - Path: `apps/gate/tests/gate-contract.test.mjs`
  - Implementation: Assert component imports and file integrity. Run `pnpm --filter @riotworks/gate test`.
  - Acceptance: Tests pass 100%, type-check passes, Prettier passes.

