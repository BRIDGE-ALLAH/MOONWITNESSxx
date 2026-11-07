# UI Package TODO

> Scope: packages/ui — shared RIOTWORKS / MOONWITNESS React UI foundation.
> Status: Backlog created. Tasks remain unchecked until implemented and verified.

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

- [ ] **P0** Audit package structure, dependencies, exports, styles, and consumer usage.
  - [ ] Record existing components and public exports.
  - [ ] Identify duplicated UI implementations in consuming apps.
  - [ ] Identify Radix packages that are used, unused, or planned.
  - [ ] Record current build, typecheck, lint, and test commands.
- [ ] **P0** Confirm package boundaries.
  - [ ] UI owns visual presentation, interaction primitives, accessibility, and reusable composition.
  - [ ] Applications own data fetching, business rules, permissions, and persistence.
  - [ ] Domain components receive data and callbacks; they do not call backend services directly.
- [ ] **P0** Define compatibility policy for React, TypeScript, Tailwind, and Radix dependencies.
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
- [ ] **P0** Add a production build pipeline.
  - [ ] Generate ESM output.
  - [ ] Generate TypeScript declaration files.
  - [ ] Decide whether CJS is required by actual consumers; do not add it without need.
  - [ ] Ensure CSS is emitted and documented as a package entry.
  - [ ] Ensure builds do not rely on consumer path aliases.
- [ ] **P0** Align TypeScript configuration for library builds.
  - [ ] Keep strict type checking enabled.
  - [ ] Separate no-emit typecheck from declaration/build configuration if needed.
  - [ ] Verify public types do not leak private source aliases.
- [ ] **P0** Define stable public entry points.
  - [ ] Export supported components, types, and variant helpers.
  - [ ] Avoid exporting internal utilities unless intentionally public.
  - [ ] Add subpath exports only where they provide a stable use case.
- [ ] **P0** Add scripts for build, typecheck, lint, and test.
- [ ] **P1** Test installation and consumption from at least one real workspace app.
  - [ ] Verify imports resolve from built output.
  - [ ] Verify styles load in the consumer.
  - [ ] Verify no duplicate React instance is bundled.
  - [ ] Verify unused components can be tree-shaken.
- [ ] **P1** Define semantic versioning and breaking-change policy.

## 2. Design tokens and themes

- [ ] **P0** Audit existing CSS variables against docs/10-design-dna.md and docs/11-design-system.md.
- [ ] **P0** Establish token layers: primitive palette, semantic tokens, and component tokens only when necessary.
- [ ] **P0** Complete semantic color tokens.
  - [ ] Text: primary, secondary, muted, inverse.
  - [ ] Surface: canvas, panel, elevated, inset, overlay, scrim.
  - [ ] Border: default, strong, subtle.
  - [ ] Interaction: focus, hover, pressed, selected, disabled.
  - [ ] Status: success, warning, danger, info, neutral, blocked.
- [ ] **P0** Implement and verify Night Riot and Paper Riot.
  - [ ] Check every semantic token in both themes.
  - [ ] Check contrast for text, borders, controls, and status indicators.
  - [ ] Ensure theme switching does not cause layout or hydration issues in supported consumers.
- [ ] **P1** Define spacing scale based on the documented 4px unit.
- [ ] **P1** Define typography roles: display, heading, body, label, overline, mono, metric.
- [ ] **P1** Define shape, border width, shadow/elevation, and layering tokens.
- [ ] **P1** Define motion duration/easing and reduced-motion behavior.
- [ ] **P1** Define compact and comfortable density modes for operational screens.
- [ ] **P1** Define z-index conventions for popovers, dialogs, drawers, toasts, and command palette.
- [ ] **P2** Add token reference documentation and examples.
- [ ] **P2** Add automated checks to prevent accidental raw color and spacing drift where practical.

## 3. Styling and asset foundations

- [ ] **P0** Verify Tailwind configuration and CSS processing order in package and consuming apps.
- [ ] **P0** Ensure package styles are consumable without private app configuration.
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
- [ ] **P0** Add package typecheck to CI.
- [ ] **P0** Add package build to CI.
- [ ] **P0** Add lint and formatting checks consistent with repository conventions.
- [ ] **P1** Add Storybook or an equivalent component workbench.
- [ ] **P1** Provide stories for variants, themes, states, and responsive examples.
- [ ] **P1** Add visual regression for high-impact components.
- [ ] **P1** Add consumer smoke test for packaging and CSS integration.
- [ ] **P1** Add accessibility checks to component stories/tests.
- [ ] **P1** Test theme switching and reduced motion.
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

- [ ] **Milestone 1 — Stabilize package:** implementation is in progress; final verification is still required.
  - [x] Audit current package entry points, dependencies, consumer usage, and existing component exports.
  - [x] Define explicit public exports and point package metadata at generated distribution output.
  - [x] Add a TypeScript build configuration that emits JavaScript and declaration files to `dist/`.
  - [x] Add package build and consumer smoke-test commands.
  - [x] Correct the CardTitle heading ref/prop type mismatch.
  - [ ] Run clean install / lockfile validation in the repository environment.
  - [ ] Run UI package build and type-check; confirm generated JS and `.d.ts` artifacts.
  - [ ] Run package consumer smoke test.
  - [ ] Run Headquarter production build against the built package.
  - [ ] Record passing command output before marking the milestone complete.
- [ ] **Milestone 2 — Lock visual foundation:** semantic tokens, themes, typography, spacing, density, motion, assets.
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


## Milestone 1 implementation notes

- Package entry points now target `dist/index.js` and `dist/index.d.ts`; styles and the Tailwind preset remain available through their existing subpaths.
- `tsconfig.build.json` emits CommonJS JavaScript, source maps, and TypeScript declarations without changing the source type-check configuration.
- `smoke-test.mjs` checks the public component/function exports using the package name.
- The CardTitle ref and prop types now both describe an HTML heading element.
- The Google Fonts import was moved ahead of Tailwind directives so it remains a valid leading CSS import.
- Build and consumer commands have been added but have **not yet been executed in a repository checkout**. Do not treat the milestone as complete until the unchecked verification tasks pass.
