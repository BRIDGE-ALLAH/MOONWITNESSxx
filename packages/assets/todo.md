# MOONWITNESS Brand & Asset Library — TODO

## Phase 0 — Brand governance
- [x] Establish MOONWITNESS as the master brand.
- [x] Define Observatory, Archive, and Signal as MOONWITNESS experience skins; keep XV as a program descriptor and RIOTWORKS as the product and operating division within MOONWITNESS.
- [x] Define Core Promise: SEE MORE. KNOW MORE.
- [x] Define Brand Manifesto: WHEN THE MOON RISES, WE SHARE MESSAGES. (WMR-WSM)
- [x] Define operational verbs and messaging hierarchy.
- [x] Record asset ownership, provenance, and licensing constraints.

## Phase 1 — Identity foundation
- [x] Create original lunar-aperture symbol.
- [x] Create wordmark and primary lockup.
- [x] Create archive seal.
- [ ] Review logo with owner and approve final master mark.
- [x] Produce a small-size symbol candidate and monochrome light/dark SVG exports (provisional pending owner approval).
- [x] Add scalable favicon SVG candidate; raster-size exports and pixel review remain pending owner approval and browser validation.

## Phase 2 — Visual DNA
- [x] Define core palette and typography roles.
- [x] Define the shared visual principles for Observatory, Archive, and the expressive Signal / Moonpunk editorial skin.
- [x] Define texture, illustration, accessibility, and motion rules.
- [x] Define Core Promise and Manifesto placement rules.
- [x] Map brand primitives to semantic semantic tokens for default Archive, .theme-archive, .dark, and .theme-observatory.
- [x] Audit primary brand foreground/background pairs and document unsafe combinations in CONTRAST-AUDIT.md; full rendered-state audit remains a release gate.

## Phase 3 — Asset library
- [x] Add original lunar contour and orbital grid textures.
- [x] Add archive ruled-paper pattern.
- [x] Add observation desk and evidence constellation illustrations.
- [x] Register new assets with static TypeScript declarations and provenance.
- [x] Add SVG safety, external-reference, and viewBox/registry-dimension tests across the complete registered asset library.
- [ ] Add optimized raster artwork only where a real use case requires it.

## Phase 4 — Typography
- [x] Specify display, body, and technical font families with fallback stacks.
- [x] Verify Space Grotesk and IBM Plex Mono upstream SIL OFL 1.1 licenses and permitted software embedding/redistribution conditions.
- [x] Document compliant font-bundling policy, copyright notices, license text, and pinned-source/hash requirements; defer binaries until a reproducible pinned import is justified.
- [ ] Owner decision on the experimental MOONWITNESS Signal font: approve its rights and required glyph/QA work, or exclude it from any product/package release.

## Phase 5 — Product integration
- [x] Replace RIOTWORKS master-brand lockup in Headquarter shell and metadata.
- [x] Add Core Promise and Brand Manifesto to Headquarter landing experience.
- [x] Map primary UI colors and typography to MoonWitness design tokens.
- [x] Review Headquarter product screens and replace visible RIOTWORKS product branding with MOONWITNESS identity.
- [x] Create semantic Observatory and Archive theme mappings and apply them to Headquarter route roots.
- [ ] Implement and verify the Signal skin profile after the token and skin registry contract is ready.
- [ ] Run browser visual regression and full component accessibility review (manual release gate; browser evidence not available in this execution).

## Phase 6 — Release
- [ ] Owner approval of logo and brand DNA.
- [ ] Declare asset licensing policy at repository root.
- [ ] Publish usage guidelines and migration checklist.
- [x] Validate all registered assets, run package tests/type-check, and verify production builds in [PR #159 Repository CI](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42420420648) (Asset Integrity and full-workspace typecheck/build passed on PR head).
