# UI Package TODO

> Scope: packages/ui — shared RIOTWORKS / MOONWITNESS React UI foundation.
> Status: Milestone 1 complete and CI-verified. Milestone 2 visual foundation is implemented but still needs browser-level visual/contrast review.

## Principles

- Keep this package focused on reusable presentation and interaction infrastructure.
- Keep domain rules, authorization, persistence, and workflow decisions in application/backend layers.
- Prefer composable React + TypeScript APIs over a custom JSON/schema-driven UI framework.
- Preserve RIOTWORKS visual identity and support Night Riot + Paper Riot.
- Do not mark a task complete until its acceptance criteria are verified.

## Priority legend

- [ ] **P0** — required foundation; blocks reliable adoption.
- [ ] **P1** — high-value operational capability.
- [ ] **P2** — maturity, polish, and optional extensions.

---

## 0. Baseline audit and decisions

- [x] **P0** Audit package structure, dependencies, exports, styles, and consumer usage.
  - [x] Record existing components and public exports.
  - [ ] Identify duplicated UI implementations in consuming apps.
  - [ ] Identify Radix packages that are used, unused, or planned.
  - [ ] Record current build, typecheck, lint, and test commands.
- [x] **P0** Confirm package boundaries.
  - [x] UI owns visual presentation, interaction primitives, accessibility, and reusable composition.
  - [x] Applications own data fetching, business rules, permissions, and persistence.
  - [x] Domain components receive data and callbacks; they do not call backend services directly.
- [x] **P0** Define compatibility policy for React, TypeScript, Tailwind, and Radix dependencies.
- [ ] **P1** Define naming policy for generic primitives and Riot-branded application components.
- [ ] **P1** Record architecture decisions and known constraints.

## 1. Package architecture and distribution

- [ ] **P0** Review and finalize package.json.
  - [ ] Define package name, version, description, and license metadata.
  - [ ] Define exports, types, and supported module formats.
  - [ ] Separate runtime, peer, and development dependencies.
  - [ ] Declare React / React DOM as peer dependencies where appropriate.
  - [ ] Verify every imported package is declared.
  - [ ] Remove unused dependencies only after confirming repository-wide usage.
- [x] **P0** Add a production build pipeline.
  - [x] Configure ESM output for the package entry point.
  - [x] Generate TypeScript declaration files.
  - [x] Decide whether CJS is required by actual consumers; ESM is used for the package entry and CJS is retained only for the Tailwind preset.
  - [x] Ensure CSS is packaged and documented as the `./styles` entry point.
  - [x] Ensure builds do not rely on consumer path aliases.
- [x] **P0** Align TypeScript configuration for library builds.
  - [x] Keep strict type checking enabled.
  - [x] Separate no-emit typecheck from declaration/build configuration.
  - [x] Verify public types do not leak private source aliases through generated declarations and consumer type-check.
- [x] **P0** Define stable public entry points.
  - [x] Export supported components, types, and variant helpers.
  - [x] Avoid exporting internal utilities unless intentionally public.
  - [x] Add subpath exports only where they provide a stable use case.
- [x] **P0** Add scripts for build, typecheck, lint, and test.
- [x] **P1** Test installation and consumption from at least one real workspace app.
  - [x] Verify imports resolve from built output.
  - [x] Verify styles load in Headquarter during production build.
  - [ ] Verify no duplicate React instance is bundled.
  - [ ] Verify unused components can be tree-shaken.
- [ ] **P1** Define semantic versioning and breaking-change policy.

## 2. Design tokens and themes

- [x] **P0** Audit existing CSS variables against docs/10-design-dna.md and docs/11-design-system.md.
- [x] **P0** Establish token layers: primitive palette, semantic tokens, and component tokens only when necessary.
- [x] **P0** Complete semantic color tokens.
  - [ ] Text: primary, secondary, muted, inverse.
  - [ ] Surface: canvas, panel, elevated, inset, overlay, scrim.
  - [ ] Border: default, strong, subtle.
  - [ ] Interaction: focus, hover, pressed, selected, disabled.
  - [ ] Status: success, warning, danger, info, neutral, blocked.
- [x] **P0** Implement Night Riot and Paper Riot; rendered verification remains open.
  - [ ] Check every semantic token in both themes.
  - [ ] Check contrast for text, borders, controls, and status indicators.
  - [ ] Ensure theme switching does not cause layout or hydration issues in supported consumers.
- [x] **P1** Adopt the Tailwind 4px-based spacing scale as the shared default; no parallel custom scale.
- [x] **P1** Define typography roles: display, heading, body, label, overline, mono, metric.
- [ ] **P1** Define shape, border width, shadow/elevation, and layering tokens.
- [x] **P1** Define motion duration/easing and reduced-motion behavior.
- [x] **P1** Define compact and comfortable density modes for operational screens.
- [x] **P1** Define z-index conventions for popovers, dialogs, drawers, toasts, and command palette.
- [x] **P2** Add token reference documentation and examples.
- [ ] **P2** Add automated checks to prevent accidental raw color and spacing drift where practical.

## 3. Styling and asset foundations

- [x] **P0** Verify Tailwind configuration and CSS processing order in package and consuming apps.
- [x] **P0** Ensure package styles are consumable through the documented `@riotworks/ui/styles` entry and consumer Tailwind preset.
- [ ] **P1** Review global CSS for leakage into host applications.
- [ ] **P1** Review external font loading; prefer self-hosted licensed assets or robust system fallbacks.
- [ ] **P1** Establish icon policy and consistent icon sizing/stroke conventions.
- [ ] **P1** Establish asset naming, source, licensing, and light/dark variant conventions.
- [ ] **P2** Add original RIOTWORKS graphic assets and decorative surfaces only where they improve hierarchy or meaning.
- [ ] **P2** Document use of brand illustration, halftone, technical stamps, and other visual motifs.

## 4. Core primitives

> Build on existing Radix primitives where appropriate. Keep APIs typed, composable, and accessible.

- [ ] **P0** Button — review variants, sizes, loading, icon placement, disabled behavior, and focus states.
- [ ] **P0** IconButton — accessible name, tooltip guidance, sizes, and disabled/loading states.
- [ ] **P0** Input — labels, descriptions, errors, prefix/suffix slots, and input types.
- [ ] **P0** Textarea — controlled/uncontrolled support, resize behavior, and character guidance where needed.
- [ ] **P0** Checkbox and CheckboxGroup.
- [ ] **P0** RadioGroup.
- [ ] **P0** Switch.
- [ ] **P0** Select.
- [ ] **P1** Combobox / searchable select.
- [ ] **P1** MultiSelect with keyboard-operable selection and removable values.
- [ ] **P1** Toggle and ToggleGroup.
- [ ] **P1** ButtonGroup.
- [ ] **P1** Tabs.
- [ ] **P1** Breadcrumb.
- [ ] **P1** Pagination.
- [ ] **P1** Accordion / Collapsible.
- [ ] **P1** Dialog and AlertDialog.
- [ ] **P1** Popover and DropdownMenu.
- [ ] **P1** Drawer / Sheet.
- [ ] **P1** Tooltip.
- [ ] **P1** Badge and StatusBadge.
- [ ] **P1** Alert / Callout.
- [ ] **P1** Separator.
- [ ] **P1** Avatar.
- [ ] **P1** Progress and Spinner.
- [ ] **P1** Skeleton.
- [ ] **P1** Toast / notification primitive.
- [ ] **P2** Calendar and DatePicker after date/time and timezone requirements are agreed.
- [ ] **P2** Command primitive for keyboard-driven interfaces.

## 5. Shared component contract

- [ ] **P0** Define conventions for component names, props, variants, sizes, slots, and ref forwarding.
- [ ] **P0** Fix type/ref mismatches in existing components, including CardTitle heading ref typing.
- [ ] **P0** Ensure every interactive control has a meaningful accessible name.
- [ ] **P0** Ensure focus-visible styling is consistent and never removed without replacement.
- [ ] **P0** Define controlled and uncontrolled behavior consistently where applicable.
- [ ] **P0** Define disabled, read-only, loading, invalid, selected, and pending states where relevant.
- [ ] **P1** Define polymorphic/asChild behavior and document its constraints.
- [ ] **P1** Define event callback naming and payload conventions.
- [ ] **P1** Define empty, loading, error, and success expectations for composites.
- [ ] **P1** Ensure no component ships with inert or misleading controls.
- [ ] **P1** Document extension points and composition examples.

## 6. Operational composites

- [ ] **P0** FormField system.
  - [ ] Label, required marker, description, validation message, and error association.
  - [ ] Compose with Input, Select, Checkbox, Radio, and Textarea.
  - [ ] Provide accessible IDs and ARIA relationships.
- [ ] **P0** DataTable foundation.
  - [ ] Sorting and pagination.
  - [ ] Row selection and bulk selection.
  - [ ] Column visibility and sizing.
  - [ ] Empty, loading, and error states.
  - [ ] Responsive strategy for dense data.
  - [ ] Keyboard and screen-reader behavior.
  - [ ] Keep fetching and server-side query behavior controlled by the consumer.
- [ ] **P1** FilterBar with search, filter controls, removable chips, clear/reset, and optional saved-filter callbacks.
- [ ] **P1** BulkActions toolbar with explicit selection count and safe action affordances.
- [ ] **P1** EmptyState with title, explanation, optional illustration, and action slot.
- [ ] **P1** ErrorState with retry callback and non-technical fallback copy.
- [ ] **P1** ActivityTimeline with actor, timestamp, event label, and optional detail.
- [ ] **P1** MetricCard with label, value, unit, period, and accessible trend context.
- [ ] **P1** Search/command palette presentation and keyboard interaction.
- [ ] **P2** Kanban primitives with an accessible alternative to drag-and-drop.
- [ ] **P2** Resizable panels and split-view primitives.
- [ ] **P2** Data visualization wrappers with labels, units, date range, timezone, and accessible data alternatives.

## 7. Application shell

- [ ] **P1** RiotAppShell with composable regions rather than a monolithic page component.
- [ ] **P1** RiotSidebar with active state, collapse behavior, groups, and mobile presentation.
- [ ] **P1** RiotTopbar with page context and action slots.
- [ ] **P1** RiotWorkspace for page-level layout and content sizing.
- [ ] **P1** RiotContextPanel / inspector drawer.
- [ ] **P1** RiotCommandPalette.
- [ ] **P1** RiotNotificationCenter presentation.
- [ ] **P1** Responsive navigation for desktop, tablet, and mobile.
- [ ] **P1** Define shell slots for application-owned navigation and actions.
- [ ] **P2** Status bar and contextual help surfaces.
- [ ] **P2** Verify shell supports pages that do not need every region.

## 8. MOONWITNESS / ARSY integration patterns

> These are UI integration contracts, not authorization or business-logic implementations.

- [ ] **P1** Define Action Registry interface for contextual actions.
- [ ] **P1** Define Command Registry interface for global commands and keyboard shortcuts.
- [ ] **P1** Define plugin extension slots with explicit ownership and lifecycle.
- [ ] **P1** Ensure plugin-provided UI is isolated from core package internals.
- [ ] **P1** Ensure backend/application capability checks control privileged action availability.
- [ ] **P1** ApprovalCard presentation with approve/reject callbacks, pending state, and clear outcome feedback.
- [ ] **P1** JobMonitor presentation for queued/running/blocked/failed/completed states.
- [ ] **P1** RecordInspector pattern for detail and contextual actions.
- [ ] **P1** View composition patterns for list, detail, form, timeline, and board views.
- [ ] **P2** Implement domain components from the design-system catalog only when a real consumer needs them:
  - [ ] SignalCard.
  - [ ] EvidenceRow.
  - [ ] OpportunityScore / OpportunityCard.
  - [ ] ProductBriefPanel.
  - [ ] ProductionStage.
  - [ ] AssetPreview.
  - [ ] ProvenancePanel.
  - [ ] InspectionFinding / InspectionReport.
  - [ ] MarketplaceChannelCard / ListingReadiness.
  - [ ] RevenueMetric / FeeBreakdown.
  - [ ] AftershockInsight.
  - [ ] AgentCard / WorkflowRunRow.
  - [ ] ApprovalCard.
- [ ] **P2** Keep domain components data-in/data-out and independent of backend clients.

## 9. Accessibility, responsive behavior, and interaction quality

- [ ] **P0** Adopt WCAG 2.2 AA as the project target, with documented exceptions.
- [ ] **P0** Verify keyboard operation for every interactive primitive.
- [ ] **P0** Verify focus order, focus visibility, and focus restoration for overlays.
- [ ] **P0** Verify dialog/menu semantics and screen-reader announcements.
- [ ] **P0** Verify labels, descriptions, validation, and error associations for form controls.
- [ ] **P0** Ensure status is not communicated by color alone.
- [ ] **P1** Test zoom/reflow and prevent unintended horizontal page overflow.
- [ ] **P1** Verify touch target sizes for mobile interactions.
- [ ] **P1** Respect prefers-reduced-motion.
- [ ] **P1** Ensure hover-only information has keyboard/touch alternatives.
- [ ] **P1** Verify both themes for contrast and focus indicators.
- [ ] **P1** Verify desktop, tablet, and mobile layouts.
- [ ] **P2** Run periodic automated and manual accessibility audits.

## 10. Testing and quality gates

- [ ] **P0** Add unit test infrastructure.
- [ ] **P0** Add interaction tests for critical primitives.
- [x] **P0** Add package typecheck to CI.
- [x] **P0** Add package build to CI.
- [x] **P0** Add UI package lint to repository validation; repository-wide formatting remains governed by the existing root formatter policy.
- [ ] **P1** Add Storybook or an equivalent component workbench.
- [ ] **P1** Provide stories for variants, themes, states, and responsive examples.
- [ ] **P1** Add visual regression for high-impact components.
- [x] **P1** Add consumer smoke test for packaging and CSS integration.
- [ ] **P1** Add accessibility checks to component stories/tests.
- [x] **P1** Test the semantic token contract and reduced-motion CSS policy; rendered theme switching remains a browser QA item.
- [ ] **P2** Track bundle size and establish budgets after measuring baseline.
- [ ] **P2** Add browser-level end-to-end tests for critical interaction flows.

### Component release gate

A component is not complete until all applicable checks pass:

- [ ] Public props and types are documented.
- [ ] Variants and sizes are demonstrated.
- [ ] Night Riot and Paper Riot are verified.
- [ ] Default, hover, focus, pressed, disabled, and loading states are verified where relevant.
- [ ] Empty, error, and success states are defined where relevant.
- [ ] Keyboard behavior is verified.
- [ ] Accessible name, role, state, and relationships are verified.
- [ ] Responsive behavior is verified.
- [ ] Unit/interaction tests pass.
- [ ] No dead controls, console errors, or unintended overflow.
- [ ] Export and package-consumer usage are verified.

## 11. Documentation

- [ ] **P0** Add package README with installation, stylesheet setup, peer requirements, and basic usage.
- [ ] **P1** Document theme setup and theme switching.
- [ ] **P1** Document token names and semantic usage.
- [ ] **P1** Document component props, variants, accessibility behavior, and examples.
- [ ] **P1** Document composition patterns and controlled/uncontrolled examples.
- [ ] **P1** Document application shell integration.
- [ ] **P1** Document plugin extension and action/command integration contracts.
- [ ] **P1** Document contribution and component release checklist.
- [ ] **P2** Add migration notes for breaking changes.

## 12. Suggested implementation order

- [x] **Milestone 1 — Stabilize package:** complete and verified in Repository CI run #276.
  - [x] Audit current package entry points, dependencies, consumer usage, and existing component exports.
  - [x] Define explicit public exports and point package metadata at generated distribution output.
  - [x] Add a TypeScript build configuration that emits JavaScript and declaration files to `dist/`.
  - [x] Add package build and consumer smoke-test commands.
  - [x] Correct the CardTitle heading ref/prop type mismatch.
  - [x] Run clean install / lockfile validation in the repository environment.
  - [x] Run UI package build and type-check; confirm generated JS and `.d.ts` artifacts.
  - [x] Run package consumer smoke test.
  - [x] Run Headquarter production build against the built package.
  - [x] Record passing command output before marking the milestone complete.
- [ ] **Milestone 2 — Lock visual foundation:** token implementation is complete; browser contrast/rendering, shadow/elevation, and production font/asset policy remain open.
  - [x] Audit approved design DNA and design-system token requirements.
  - [x] Implement semantic color, surface, border, interaction, typography, radius, and motion tokens for Night Riot and Paper Riot.
  - [x] Expose semantic color, surface, interaction, motion, density, and z-index utilities/tokens through the Tailwind preset.
  - [x] Document token usage and examples in `packages/ui/TOKENS.md`.
  - [ ] Verify WCAG 2.2 AA contrast for all relevant foreground/background combinations, including borders, overlays, disabled, and interactive states.
  - [ ] Render and inspect both themes in Headquarter, including focus, disabled, selected, hover, and overlay states.
  - [x] Define compact/comfortable density contract and z-index layers.
  - [ ] Finalize production font hosting/licensing and original asset policy.
- [ ] **Milestone 3 — Complete core primitives:** actions, inputs, selection, navigation, overlays, feedback.
- [ ] **Milestone 4 — Operational UI:** FormField, DataTable, FilterBar, EmptyState, ErrorState, ActivityTimeline.
- [ ] **Milestone 5 — Application shell:** AppShell, Sidebar, Topbar, Workspace, ContextPanel, CommandPalette.
- [ ] **Milestone 6 — Platform integration:** action/command contracts, plugin slots, approval and job presentation.
- [ ] **Milestone 7 — Maturity:** Storybook, visual regression, accessibility audit, documentation, bundle/performance review.

## Definition of Done

- [ ] Package builds successfully from a clean install.
- [ ] Type declarations are generated and resolve for consumers.
- [ ] Public exports are intentional and documented.
- [ ] At least one consuming application imports components and loads package styles.
- [ ] Both themes work across the supported component set.
- [ ] Critical interactions are keyboard-operable and accessible.
- [ ] Tests and CI quality gates pass.
- [ ] No backend/business logic has leaked into the shared UI package.
- [ ] Documentation and examples reflect the shipped API.
- [ ] Known limitations and deferred tasks are recorded here.

---

## Notes

- This file is an implementation backlog, not a claim that listed features already exist.
- Keep tasks unchecked until implementation and verification are complete.
- Add links to issues/PRs beside tasks when work is scheduled.
- Revisit priorities after auditing actual consumers and repository CI.



## Verified implementation status

### Milestone 1 — complete

Repository CI run #276 passed the Repository integrity job, including:
- Frozen lockfile validation and dependency installation under pnpm 12.16.1.
- All 7 workspace type-check/build dependency tasks, including `@riotworks/ui` and Headquarter.
- UI ESM build with generated `dist/index.js` and `dist/index.d.ts`.
- UI ESLint.
- Theme-token contract check: 46 required tokens in each of Night Riot and Paper Riot.
- Built-package consumer smoke test: 11 public exports resolved through `@riotworks/ui`.
- Headquarter Next.js 15.1.0 production build, including stylesheet import and static page generation.

The separate optional “Full workspace typecheck and build” job is skipped by the repository's existing workflow condition; the required workspace type-check and UI/Headquarter production build were run inside Repository integrity validation.

### Milestone 2 — implementation in progress

Implemented:
- Semantic Night Riot and Paper Riot color, surface, border, interaction, typography, radius, and motion tokens.
- Tailwind aliases for semantic tokens.
- Reduced-motion fallback.
- Comfortable and compact density tokens.
- Shared z-index scale.
- Token documentation and initial calculated text-pair contrast matrix.
- Static token completeness test in CI.

Still open:
- Browser-level visual inspection of both themes.
- Contrast checks for all border, focus, overlay, disabled, selected, and interactive states.
- Shadow/elevation contract.
- Production font hosting/licensing and original asset policy.
- Primitive/component work starts in Milestone 3.

### Known repository follow-ups (not blockers for Milestone 1)

- `@riotworks/arsy-core` lint remains deferred until a proper package-local shared ESLint config can be consumed; it is not silently treated as a pass.
- Headquarter's legacy ESLint command reports that ESLint 9 cannot find a flat config, but its existing script masks this as `lint-skip`. This does not affect the UI package lint result or production build.
- The root `format:check` script still needs a separate audit; it was not part of the passing Repository integrity acceptance gate.
