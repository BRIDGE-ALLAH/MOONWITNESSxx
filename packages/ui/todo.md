# UI Package TODO

> Scope: packages/ui — shared RIOTWORKS / MOONWITNESS React UI foundation.
> Status: Milestones 1 and 3–9 implemented; CI verified for Milestones 7–9. Remaining release gates are browser visual QA, accessibility review, Headquarter ESLint 9 cleanup, and branch synchronization.

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

- [x] **P0** Button — variants, sizes, loading, composition (`asChild`), disabled behavior, and focus states implemented.
- [x] **P0** IconButton — sizes, disabled/loading states, and tooltip-compatible native title/ARIA props implemented; consumers must supply an accessible name.
- [x] **P0** Input — input types, invalid state, and FormField label/description/error composition implemented; prefix/suffix slots remain deferred.
- [x] **P0** Textarea — controlled/uncontrolled values, invalid state, and optional character count implemented.
- [x] **P0** Checkbox and CheckboxGroup.
- [x] **P0** RadioGroup (native keyboard-operable radio inputs).
- [x] **P0** Switch.
- [x] **P0** Select.
- [ ] **P1** Combobox / searchable select.
- [ ] **P1** MultiSelect with keyboard-operable selection and removable values.
- [ ] **P1** Toggle and ToggleGroup.
- [ ] **P1** ButtonGroup.
- [x] **P1** Tabs.
- [x] **P1** Breadcrumb.
- [x] **P1** Pagination.
- [ ] **P1** Accordion / Collapsible.
- [ ] **P1** Dialog and AlertDialog.
- [ ] **P1** Popover and DropdownMenu.
- [ ] **P1** Drawer / Sheet.
- [x] **P1** Tooltip.
- [ ] **P1** Badge and StatusBadge.
- [x] **P1** Alert / Callout.
- [x] **P1** Separator.
- [x] **P1** Avatar with image-load fallback.
- [x] **P1** Progress and Spinner.
- [x] **P1** Skeleton.
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

- [x] **P0** FormField system.
  - [x] Label, required marker, description, validation message, and error association.
  - [x] Compose with Input, Select, Checkbox, Radio, and Textarea through the typed control render-prop.
  - [x] Provide accessible IDs and ARIA relationships.
- [x] **P0** DataTable foundation (client-side presentation primitives; see deferred behaviors below).
  - [x] Sorting and pagination.
  - [x] Row selection and bulk selection with controlled/uncontrolled state.
  - [ ] Column visibility and sizing.
  - [ ] Empty, loading, and error states.
  - [x] Responsive overflow strategy for dense data.
  - [ ] Keyboard and screen-reader behavior.
  - [x] Keep fetching and server-side query behavior controlled by the consumer.
- [ ] **P1** FilterBar with search, filter controls, removable chips, clear/reset, and optional saved-filter callbacks.
- [x] **P1** BulkActions toolbar with explicit selection count and consumer-owned action affordances.
- [x] **P1** EmptyState with title, explanation, optional icon, and action slot.
- [x] **P1** ErrorState with retry callback and non-technical fallback copy.
- [x] **P1** ActivityTimeline with actor, timestamp, event label, and optional detail.
- [x] **P1** MetricCard with label, value, unit, period, and textual trend context.
- [x] **P1** Search/command palette presentation and keyboard interaction.
- [ ] **P2** Kanban primitives with an accessible alternative to drag-and-drop.
- [ ] **P2** Resizable panels and split-view primitives.
- [ ] **P2** Data visualization wrappers with labels, units, date range, timezone, and accessible data alternatives.

## 7. Application shell

- [x] **P1** RiotAppShell with composable regions rather than a monolithic page component.
- [x] **P1** RiotSidebar with active state, collapse behavior, groups, and mobile presentation.
- [x] **P1** RiotTopbar with page context and action slots.
- [x] **P1** RiotWorkspace for page-level layout and content sizing.
- [ ] **P1** RiotContextPanel / inspector drawer.
- [x] **P1** RiotCommandPalette with Ctrl/Cmd+K, search, grouping, and callback execution.
- [ ] **P1** RiotNotificationCenter presentation.
- [x] **P1** Responsive navigation for desktop, tablet, and mobile (desktop collapse + mobile navigation dialog).
- [x] **P1** Define shell slots for application-owned navigation and actions.
- [ ] **P2** Status bar and contextual help surfaces.
- [x] **P2** Verify shell supports pages that do not need every region (all shell regions are optional).

## 8. MOONWITNESS / ARSY integration patterns

> These are UI integration contracts, not authorization or business-logic implementations.

- [x] **P1** Define Action Registry interface for contextual actions.
- [x] **P1** Define Command Registry interface for global commands and keyboard shortcuts.
- [x] **P1** Define plugin extension slots with explicit owner, priority, enablement predicate, and unregister lifecycle.
- [ ] **P1** Ensure plugin-provided UI is isolated from core package internals.
- [x] **P1** Define application-provided capability filtering hooks; server authorization remains mandatory at execution.
- [x] **P1** ApprovalCard presentation with approve/reject callbacks, pending state, and outcome status.
- [x] **P1** JobMonitor presentation for queued/running/blocked/succeeded/failed/cancelled states.
- [x] **P1** RecordInspector pattern for detail fields, status, and contextual action slots.
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
- [x] **P1** Document application shell integration.
- [x] **P1** Document plugin extension and action/command integration contracts.
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
- [x] **Milestone 3 — Core primitives delivered:** actions, inputs, selection, navigation, overlays, and feedback foundations shipped; advanced P1/P2 controls remain listed as follow-ups.
- [x] **Milestone 4 — Operational UI foundations delivered:** FormField, DataTable, FilterBar, BulkActions, EmptyState, ErrorState, MetricCard, and ActivityTimeline shipped; advanced DataTable/FilterBar behaviors remain open.
- [x] **Milestone 5 — Application shell foundation delivered:** AppShell, Sidebar, Topbar, Workspace, desktop ContextPanel, and CommandPalette. Mobile context-panel drawer and notification center remain follow-ups.
- [x] **Milestone 6 — Platform integration foundation delivered:** typed action/command/plugin registries, approval/job/record presentation, and integration documentation. Plugin sandbox isolation and domain-specific workflow views remain application-level follow-ups.
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
- Core primitives and operational composites were delivered in Milestones 3 and 4; advanced controls and interaction QA remain open.

### Known repository follow-ups (not blockers for Milestone 1)

- `@riotworks/arsy-core` lint remains deferred until a proper package-local shared ESLint config can be consumed; it is not silently treated as a pass.
- Headquarter's legacy ESLint command reports that ESLint 9 cannot find a flat config, but its existing script masks this as `lint-skip`. This does not affect the UI package lint result or production build.
- The root `format:check` script still needs a separate audit; it was not part of the passing Repository integrity acceptance gate.


## Milestone 3–4 delivery record

**Repository CI run #407 — success**  
Commit: `c0e51bcb0e039c06ad64c492bd79e81790a6404d`

Implemented and exported:
- Core controls: Button (loading + `asChild` composition), IconButton, Input, Textarea, Checkbox, CheckboxGroup, RadioGroup, Switch, Select.
- Navigation and overlays: Tabs, Breadcrumb, Pagination, Dialog, Popover, Tooltip.
- Feedback and identity: Alert, Progress, Spinner, Skeleton, Avatar.
- Operational composition: FormField, DataTable, FilterBar, BulkActions, EmptyState, ErrorState, MetricCard, ActivityTimeline.
- README usage examples and consumer export smoke coverage (47 exports).

CI verified frozen lockfile, repository audit, all 7 workspace type-check/build tasks, UI lint, theme token contract, UI package build, consumer smoke test, and Headquarter production build/prerender.

Deferred rather than overstated:
- Combobox/MultiSelect, Toggle/ToggleGroup, ButtonGroup, Accordion, AlertDialog, DropdownMenu, Drawer/Sheet, Toast provider, and Command palette.
- DataTable column visibility/sizing and dedicated loading/error render slots; keyboard/screen-reader and browser interaction audit.
- FilterBar removable chips and saved-filter callbacks.
- IconButton accessible name must be supplied by the consumer (for example `aria-label`).
- Unit/interaction test infrastructure and visual regression.


## Milestone 5–6 delivery record

**Repository CI run #529 — success**  
Commit: `da0fecb1496a4a8d9c8812fb63b7f3f7db31af54`

Delivered:
- Composable RiotAppShell with optional sidebar, topbar, context panel, status bar, desktop collapse, and mobile navigation dialog.
- RiotSidebar, RiotTopbar, RiotWorkspace, RiotContextPanel, RiotCommandPalette (Ctrl/Cmd+K), and notification live-region wrapper.
- Headquarter AppShell migrated to @riotworks/ui shell primitives; existing route structure, locale/theme controls, and module navigation retained.
- Typed in-memory Action Registry, Command Registry, and Plugin Slot Registry with duplicate-ID protection, cleanup callbacks, enablement filtering, and priority ordering.
- ApprovalCard, JobMonitor, and RecordInspector as data-in/callback-out presentation components.
- PLATFORM.md documenting ownership, capability checks, plugin registration, and approval/job integration contracts.
- Consumer smoke test expanded to 61 public exports.

CI run #529 passed repository audit, frozen lockfile, workspace type-check/build tasks, lint tasks, theme contract, package ESM build, consumer smoke test, and Headquarter Next.js production compilation/prerender (15 static pages).

Still deferred and intentionally not claimed complete:
- Mobile context-panel drawer and a complete notification-center popover/feed.
- Plugin runtime isolation/sandboxing; a React slot registry is not a security sandbox.
- Domain-specific list/detail/form/timeline/board compositions.
- Server authorization, approval policy, persistence, job orchestration, retry/cancel policy, and audit logging remain application/backend responsibilities.
- Full keyboard/screen-reader/browser QA and interaction tests.


## Milestone 7 — maturity and visual identity delivery

**Implemented and CI-verified on `feat-ui-package-milestone-1-2` at `fb070dba646ae9414a8735c999e39e112a0242ec`.**

Delivered in this pass:
- [x] Add a practical component workbench at `apps/headquarter/src/app/ui-lab/page.tsx`, rendering the real shared package in the actual host shell.
- [x] Recompose the Headquarter landing page around the MOONWITNESS signal story, with a cinematic hero and a clear Observe → Interpret → Make rhythm.
- [x] Add MOONWITNESS visual DNA contract: nocturnal intelligence, signal energy, editorial scale, instrument language, and living-but-not-noisy motion (`VISUAL-DNA.md`).
- [x] Add `RiotSignalHeader`, `RiotLiveIndicator`, and `RiotAtmosphere` as reusable, typed, public brand-language components.
- [x] Add restrained signal pulse, ambient drift, grid, and grain treatments with reduced-motion fallbacks.
- [x] Add Node built-in test coverage for semantic theme tokens, focus visibility, reduced motion, accessible live status, public exports, and workbench presence.
- [x] Add a 600 KiB uncompressed JavaScript output budget check after package build.
- [x] Expand consumer smoke coverage for the new public exports.
- [x] Document visual language and workbench operation in `VISUAL-DNA.md`, `WORKBENCH.md`, and README.

Still open (not represented as completed):
- [ ] Run visual review in a real browser at desktop/tablet/mobile widths in both Night Riot and Paper Riot.
- [ ] Run axe-core/WCAG 2.2 AA automated and manual checks; static contract tests are not a substitute.
- [ ] Add screenshot-based visual regression after selecting and adopting browser automation.
- [ ] Decide on self-hosted font assets after license, privacy, and performance review.
- [ ] Measure and optimize the production CSS payload separately from the JavaScript budget.
- [ ] Add keyboard/screen-reader interaction tests for dialogs, command palette, data table, and shell navigation.

### Quality gate boundary

The workbench is an in-app component inventory, not Storybook. The new Node tests are static contract tests, not browser interaction or screenshot tests. The bundle budget measures emitted JavaScript bytes only and does not represent compressed transfer size or CSS size. CI results will determine whether the implemented package gate passes.


## Milestone 8 — Signal Constellation (implemented; CI verified)

**Purpose:** make relationships and evidence inspectable instead of reducing signal intelligence to disconnected cards.

- [x] Add typed `RiotSignalConstellation` and `RiotSignalNode` / `RiotSignalLink` contracts.
- [x] Render host-supplied relationships as a navigable constellation with keyboard-operable node buttons.
- [x] Add selected-node inspector with description, source, observed time, evidence, and optional confidence.
- [x] Add empty state, responsive field, focus-visible states, and reduced-motion-safe interaction styling.
- [x] Add explicit trust boundary: component does not infer edges, confidence, or telemetry.
- [x] Add the experience to the Headquarter UI workbench and public package exports.

**Not claimed:** graph layout algorithms, live streaming, clustering, anomaly detection, or inferred causal links. The host supplies nodes, positions, relationships, and evidence.

## Milestone 9 — Decision Memory / Decision Trail (implemented; CI verified)

**Purpose:** give every important change a readable “what happened / why / based on what” path.

- [x] Add typed `RiotDecisionTrail` and event contracts for observed, interpreted, decided, actioned, and changed events.
- [x] Add selectable chronological event rail and rationale/evidence inspector.
- [x] Add keyboard-operable event selection, responsive inspector layout, and empty state.
- [x] Clearly distinguish the presentation trail from immutable audit logs or backend event sourcing.
- [x] Add illustrative scenario to UI workbench and document the pattern.

**Not claimed:** event persistence, replay execution, tamper-proof audit, actor authentication, or policy evaluation. Those remain host/backend guarantees.

## Consolidated finish gates — Milestones 7–9

- [x] Add registry lifecycle tests for duplicate/blank IDs, safe unregister behavior, deterministic lookup, and plugin priority filtering.
- [x] Correct demo status labels so static examples are not presented as live telemetry.
- [x] Correct notification live-region rendering so children are not duplicated visually and in assistive technology.
- [x] Ensure the UI workbench's primary CTA navigates to the signal experience.
- [x] Verify the latest branch head with GitHub Actions run [#783](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42398407878) — success on `fb070dba646ae9414a8735c999e39e112a0242ec`.
- [x] Resolve TypeScript and JSX issues surfaced by CI; required type-check/build, UI lint, 8 Node tests, theme contract, consumer smoke test, JS budget, and Headquarter production build now pass.
- [ ] Resolve the existing Headquarter ESLint 9 flat-config skip and audit the root `format:check` script; these are repository-level follow-ups, not silently counted as passed.
- [ ] Perform human browser review in both themes at desktop and mobile widths.
- [ ] Run WCAG 2.2 AA / axe-core and keyboard + screen-reader review before calling accessibility fully verified.
- [ ] Decide whether Playwright visual regression is worth adding as a maintained dependency after the first browser QA pass.

### Release boundary

Milestones 7–9 are implementation-complete and verified by Repository CI run #783 for the code head. A later documentation-only update was verified by run #786. The separate optional full-workspace quality job was skipped by the existing `FULL_QUALITY_CI` condition. Headquarter's legacy ESLint 9 command still falls back to `lint-skip`; UI package lint passed. Browser visual review and accessibility audits remain release gates. PR #24 is also 29 commits behind `main` and GitHub reports `mergeable_state: dirty`; synchronize the branch and resolve conflicts before merge.


### Latest CI evidence — run #783

- [Repository CI run #783](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42398407878) — **SUCCESS**.
- Commit: `fb070dba646ae9414a8735c999e39e112a0242ec`.
- Workspace type-check: 7 tasks successful.
- UI lint: successful.
- Theme contract: 46 required tokens in each of 2 themes.
- ESM build and consumer smoke test: 66 public exports.
- Node tests: 8 passed, 0 failed.
- Emitted JavaScript budget: 62,273 bytes / 614,400 bytes.
- Headquarter production build: compiled and prerendered 16/16 pages, including `/ui-lab`.
- Caveats: Headquarter lint still uses its existing ESLint 9 `lint-skip` fallback; optional Full workspace typecheck/build job was skipped by workflow condition. Browser visual QA, axe/WCAG 2.2 AA, and screen-reader review remain open.
