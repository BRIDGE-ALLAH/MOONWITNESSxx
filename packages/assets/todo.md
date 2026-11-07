# @riotworks/assets — Implementation Roadmap

> **Mission:** Own the visual foundation of MOONWITNESS / RIOTWORKS through a reliable, programmatic, reusable, and enterprise-ready asset system.
>
> **Status:** Planning
> **Priority:** P0 foundation, then P1 adoption and expansion
> **Package:** `@riotworks/assets`
> **Location:** `packages/assets`

---

## 1. Product Intent

Build one trusted home for visual assets used across the monorepo: brand marks, original illustrations, characters, textures, custom symbols, motion resources, typography files, and document graphics.

The package must make approved assets easy to discover, reference, render, validate, and maintain. It is an asset library and runtime integration layer—not a CMS, database, media server, or business-logic package.

### Outcomes

- One canonical source for owned and approved visual assets.
- Stable, typed, programmatic declarations for static assets.
- Consistent visual identity across Headquarter, ARSY, and future applications.
- Clear separation between MOONWITNESS identity and RIOTWORKS product identity.
- Asset provenance, licensing, accessibility, optimization, and integrity are maintainable.
- Applications consume assets through documented public APIs instead of scattered paths and duplicated files.

### Design DNA

Implementation must follow:

- `docs/10-design-dna.md`
- `docs/11-design-system.md`

Preserve the visual direction: **EXTREME RIOT + ORIGINAL MOONWITNESS COMIC + INDUSTRIAL BRUTALISM + PREMIUM GAME HUD + PUNK ZINE**.

Respect the two visual modes:

- **Riot mode:** expressive artwork, campaigns, storytelling, product creation.
- **Control mode:** readable operational data, finance, tables, forms, approvals, policies, errors, and audit trails.

Use the established palette, typography direction, texture restraint, and Night Riot / Paper Riot theme intent. Do not introduce a disconnected visual language.

---

## 2. Architectural Decisions (Locked)

### 2.1 Package boundary

| Package | Owns | Must not own |
|---|---|---|
| `@riotworks/assets` | Original visual files, asset organization, static registry, asset metadata, asset resolution, asset rendering helpers | Business logic, application workflows, UI primitives, backend storage |
| `@riotworks/ui` | Buttons, inputs, cards, dialogs, tables, layout, interaction patterns, theme tokens, component styling | A duplicated copy of the canonical asset library |
| Applications | Product-specific composition, routes, page layouts, domain workflows | Private copies of shared brand or canonical illustration assets |

Dependency direction:

- `@riotworks/assets` must not depend on `@riotworks/ui`.
- `@riotworks/ui` may consume assets when a concrete integration is useful.
- Applications may consume both packages.
- Avoid circular dependencies.

### 2.2 Programmatic, static-first architecture

- Use ordinary TypeScript declarations and a statically defined registry.
- Keep asset names, references, and public APIs discoverable at development time.
- Do not introduce a database, runtime schema engine, remote registry service, or CMS for repository-owned static assets.
- Do not build a generic plugin system for assets.
- Add runtime configurability only when a real application requirement demonstrates the need.
- Prefer explicit declarations over convention-heavy magic and hidden file-system behavior.

### 2.3 Brand ownership

MOONWITNESS and RIOTWORKS are distinct identities.

- MOONWITNESS assets represent the original project / universe identity.
- RIOTWORKS assets represent the product / organization identity.
- They may share infrastructure and visual principles, but must not be silently substituted for one another.
- Every brand asset must identify which identity it belongs to.

### 2.4 Asset delivery

- Prefer package-managed, locally owned assets over third-party hotlinks.
- Keep original editable sources where practical.
- Choose formats based on actual asset characteristics.
- Do not embed large assets as base64 in source code.
- Do not force every asset through one universal rendering component if a simpler native reference is more appropriate.
- Ensure the chosen package export and static-file strategy works with the monorepo's actual build tools before expanding the API.

### 2.5 Static assets vs user content

This package manages product-owned and repository-owned visual resources.

It does **not** manage user uploads, customer media, generated documents, operational attachments, or tenant content. Those require application/backend storage and lifecycle policies outside this package.

---

## 3. Proposed Package Structure

Adjust details to the repository's actual TypeScript, React, build, and test conventions before implementation. Avoid creating empty abstractions just to match this tree.

```text
packages/assets/
├── package.json
├── README.md
├── todo.md
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── registry/
│   │   ├── index.ts
│   │   ├── brands.ts
│   │   ├── illustrations.ts
│   │   ├── characters.ts
│   │   ├── textures.ts
│   │   ├── symbols.ts
│   │   └── motion.ts
│   ├── components/
│   │   ├── Asset.tsx
│   │   ├── BrandLogo.tsx
│   │   ├── Illustration.tsx
│   │   ├── Character.tsx
│   │   └── Texture.tsx
│   └── utils/
│       └── resolve-asset.ts
├── assets/
│   ├── brand/
│   │   ├── moonwitness/
│   │   └── riotworks/
│   ├── characters/
│   │   ├── core/
│   │   ├── expressions/
│   │   └── poses/
│   ├── illustrations/
│   │   ├── empty-states/
│   │   ├── errors/
│   │   ├── success/
│   │   ├── onboarding/
│   │   └── features/
│   ├── icons/
│   │   ├── brand/
│   │   └── custom/
│   ├── textures/
│   │   ├── halftone/
│   │   ├── grain/
│   │   ├── paper/
│   │   └── industrial/
│   ├── patterns/
│   ├── motion/
│   ├── typography/
│   └── documents/
├── scripts/
│   ├── validate-assets.ts
│   ├── optimize-assets.ts
│   └── generate-registry.ts
└── tests/
    ├── registry.test.ts
    └── asset-integrity.test.ts
```

**Structure rule:** the registry may be maintained manually in TypeScript first. A registry generator is optional and must only be introduced if it removes proven repetitive work without hiding ownership or making asset references difficult to review.

---

## 4. Milestone Overview

| Milestone | Priority | Goal | Depends on |
|---|---:|---|---|
| M1 — Architecture & package foundation | P0 | Establish package, boundaries, conventions, and public contract | None |
| M2 — Registry & runtime integration | P0 | Make assets discoverable and consumable through typed APIs | M1 |
| M3 — Visual foundation | P0 | Establish canonical brand, typography, icon, and texture assets | M1, M2 |
| M4 — Original creative library | P1 | Add useful character and illustration families | M2, M3 |
| M5 — Quality, optimization & governance | P1 | Enforce integrity, provenance, accessibility, and size budgets | M1–M4 |
| M6 — Ecosystem adoption | P1 | Integrate and standardize usage across applications | M2–M5 |

---

# 5. Detailed Tasks

## M1 — Architecture & Package Foundation

**Priority:** P0  
**Objective:** Create a minimal, valid package foundation aligned with the existing monorepo.

### 1.1 Repository reconnaissance

- [ ] Inspect workspace conventions in the root `package.json` and `pnpm-workspace.yaml`.
- [ ] Inspect `packages/ui/package.json`, exports, build scripts, TypeScript configuration, and tests.
- [ ] Inspect application bundlers and static asset handling in Headquarter and ARSY.
- [ ] Identify existing assets and avoid duplicating or moving files without a migration plan.
- [ ] Confirm package naming and dependency conventions used in the monorepo.
- [ ] Record any build-system constraints that affect SVG, fonts, CSS, and static file exports.

### 1.2 Package scaffold

- [ ] Create `packages/assets/package.json` using repository conventions.
- [ ] Set package name to `@riotworks/assets` if it does not conflict with an existing package.
- [ ] Configure package entry points and public exports.
- [ ] Configure TypeScript build/type-check integration consistently with sibling packages.
- [ ] Add only the dependencies actually required by the initial implementation.
- [ ] Avoid adding a UI framework dependency to the asset files themselves.
- [ ] Add a minimal `src/index.ts` public entry point.
- [ ] Add a package README describing purpose, installation/workspace usage, and boundaries.
- [ ] Ensure the package is included by the existing workspace without unnecessary root configuration changes.

### 1.3 Conventions and contracts

- [ ] Define canonical asset naming: lowercase kebab-case for file names.
- [ ] Define stable logical IDs separately from physical file paths.
- [ ] Define category boundaries: brand, character, illustration, icon/symbol, texture, pattern, motion, typography, document.
- [ ] Define theme applicability: universal, light, dark, or explicitly named theme variants.
- [ ] Define accessibility expectations for meaningful vs decorative assets.
- [ ] Define provenance requirements: source, creator/owner, and license or usage permission.
- [ ] Define how deprecated assets are marked and replaced.
- [ ] Document the dependency direction between assets, UI, and applications.

### 1.4 Initial type contract

- [ ] Add small, practical TypeScript types for asset identity and shared metadata.
- [ ] Keep category-specific metadata separate where requirements differ.
- [ ] Avoid a large generic metadata schema that forces irrelevant fields onto every asset.
- [ ] Represent asset variants explicitly where they are meaningful.
- [ ] Ensure public types do not expose internal file-system implementation details.

### Acceptance criteria

- [ ] Package is recognized by pnpm workspace tooling.
- [ ] Package can be type-checked and built using repository-standard commands.
- [ ] Public entry point exists and has no dependency on `@riotworks/ui`.
- [ ] README documents package purpose, boundaries, naming, and ownership.
- [ ] No database, CMS, runtime schema engine, or unnecessary service is introduced.
- [ ] Existing applications continue to build.

---

## M2 — Typed Registry & Runtime Integration

**Priority:** P0  
**Objective:** Provide a simple, typed, stable way for applications to consume approved assets.

### 2.1 Registry implementation

- [ ] Create a statically declared registry using TypeScript.
- [ ] Organize registry entries by meaningful asset domains.
- [ ] Keep logical asset IDs stable and readable.
- [ ] Register only real files that exist in the repository.
- [ ] Support explicit variants when a brand, illustration, or asset has multiple approved forms.
- [ ] Keep registry declarations reviewable; avoid opaque generated output as the only source of truth.
- [ ] Export registry types and public lookup functions without leaking internal implementation.

### 2.2 Resolution API

- [ ] Implement a predictable resolver from logical ID to the package's consumable asset reference.
- [ ] Define behavior for unknown IDs (clear development-time error or documented safe fallback).
- [ ] Avoid silently returning unrelated assets.
- [ ] Avoid constructing unsafe paths from arbitrary user input.
- [ ] Ensure references work in the actual Vite / application build configuration used by the repository.
- [ ] Verify production build output and asset URLs, not only development mode.
- [ ] Document any bundler-specific limitation or required configuration.

### 2.3 Rendering helpers

- [ ] Add a generic `Asset` component only if it provides real value beyond native image/SVG usage.
- [ ] Add `BrandLogo` with explicit brand and variant selection.
- [ ] Add `Illustration` with meaningful alt text and decorative handling.
- [ ] Add `Character` only after the character asset contract is established.
- [ ] Add `Texture` with safe defaults and decorative accessibility behavior.
- [ ] Keep components small, predictable, and composable.
- [ ] Avoid duplicating image behavior that already belongs to the application or UI layer.
- [ ] Ensure decorative assets do not pollute the accessibility tree.
- [ ] Ensure meaningful images have an accessible text alternative.

### 2.4 Public API and usage examples

Target API direction (illustrative; finalize after testing the actual build pipeline):

```tsx
import {
  Asset,
  BrandLogo,
  Illustration,
  Texture,
} from "@riotworks/assets";

<BrandLogo brand="riotworks" variant="primary" />
<Illustration name="empty-search" />
<Texture name="halftone" opacity={0.08} />
<Asset name="brand.riotworks.symbol" />
```

- [ ] Validate the API against real application usage before locking it.
- [ ] Prefer constrained TypeScript unions / inferred registry keys over free-form strings where practical.
- [ ] Ensure consumers do not need to know the physical folder layout.
- [ ] Document when native `img`, inline SVG, CSS background, or a package component is the better choice.

### Acceptance criteria

- [ ] Registry entries resolve to real assets.
- [ ] Public API is typed and documented.
- [ ] Asset references work in development and production builds.
- [ ] Missing asset behavior is deterministic and understandable.
- [ ] Accessibility behavior is covered by tests or explicit component checks.
- [ ] No consumer needs to duplicate a canonical asset just to use it.

---

## M3 — Visual Foundation

**Priority:** P0  
**Objective:** Establish the minimum approved visual asset foundation before expanding into a large creative library.

### 3.1 Brand identity assets

- [ ] Audit current MOONWITNESS and RIOTWORKS logos, marks, and symbols.
- [ ] Establish canonical primary logo and symbol for each identity.
- [ ] Add variants only where there is a real usage need (e.g. compact, monochrome, reversed).
- [ ] Verify legibility on Obsidian / dark surfaces and Paper Bone / light surfaces.
- [ ] Add application marks and favicon assets where approved source artwork exists.
- [ ] Preserve original vector/source files when available.
- [ ] Document usage restrictions and clear-space / minimum-size guidance where applicable.
- [ ] Do not invent a new logo or alter brand geometry as part of technical integration.

### 3.2 Typography resources

- [ ] Audit current font loading and font declarations in `packages/ui` and applications.
- [ ] Confirm font licenses and redistribution rights before bundling.
- [ ] Prefer self-hosted, licensed font files for production reliability when appropriate.
- [ ] Establish approved display, interface, and monospace font roles from the design direction.
- [ ] Add WOFF2 files only when license and source are verified.
- [ ] Define sensible system fallbacks and font-weight mappings.
- [ ] Coordinate font tokens and typography usage with `packages/ui`.
- [ ] Avoid loading duplicate font families or weights across applications.

### 3.3 Iconography and symbols

- [ ] Establish Lucide (or the repository's existing functional icon library) as the functional UI icon convention.
- [ ] Do not copy or recreate icons already provided by the functional icon library.
- [ ] Separate branded symbols and original graphic marks from functional UI icons.
- [ ] Define naming and sizing conventions for custom symbols.
- [ ] Ensure icons remain legible at their intended sizes and contrast levels.
- [ ] Document when to use a functional icon vs a branded symbol vs an illustration.

### 3.4 Texture and graphic primitives

- [ ] Create a restrained, reusable halftone family.
- [ ] Create subtle grain / noise resources where technically justified.
- [ ] Add paper and industrial surface treatments only when they reinforce the design DNA.
- [ ] Add comic / punk graphic motifs only as approved original resources.
- [ ] Provide safe opacity and scale guidance.
- [ ] Ensure textures never compromise text contrast, focus indicators, or data readability.
- [ ] Ensure textures can be disabled or reduced where motion / visual effects preferences require it.
- [ ] Avoid full-screen noise, excessive overlays, and random neon decoration.

### Acceptance criteria

- [ ] Both identities have clearly separated canonical asset entries.
- [ ] Font assets have verified license/source information.
- [ ] Functional icon and custom symbol responsibilities are documented.
- [ ] Initial textures follow the visual DNA and remain subtle.
- [ ] Assets have been reviewed in both Riot and Control contexts where applicable.
- [ ] UI tokens remain owned by `packages/ui`, not duplicated in this package.

---

## M4 — Original Creative Library

**Priority:** P1  
**Objective:** Build a coherent library of original artwork that adds identity and product clarity without turning every screen into decoration.

### 4.1 Character system

- [ ] Identify approved core characters and their ownership/source artwork.
- [ ] Establish character identity and canonical base artwork before adding variants.
- [ ] Define a consistent expression vocabulary (e.g. neutral, focused, curious, concerned, excited) based on actual creative direction.
- [ ] Define pose variants only where they serve a real product or storytelling use.
- [ ] Keep character identity, proportions, and visual continuity consistent across assets.
- [ ] Organize expressions and poses without duplicating the same artwork unnecessarily.
- [ ] Provide appropriate light/dark or surface variants only when required.
- [ ] Document intended use and prohibited misuse for each character.
- [ ] Do not use emoji or generic stock mascots as substitutes for original character artwork.

### 4.2 Product illustration families

- [ ] Create a consistent empty-state family for meaningful product scenarios.
- [ ] Create error and recovery illustrations where they improve comprehension.
- [ ] Create success / completion illustrations where appropriate.
- [ ] Create onboarding and feature explanation illustrations.
- [ ] Create campaign/editorial illustrations for Riot mode.
- [ ] Keep operational Control mode pages restrained and information-first.
- [ ] Avoid producing many near-identical illustrations without a concrete product use case.

### 4.3 Application visual resources

- [ ] Add approved login / entry visuals if required.
- [ ] Add section and page decoration assets only where they support hierarchy.
- [ ] Add banners and feature graphics with documented aspect-ratio expectations.
- [ ] Ensure responsive crops or variants are intentional.
- [ ] Keep page composition and application-specific layout outside the asset package.

### Acceptance criteria

- [ ] Each creative asset has an identifiable purpose and owner/source.
- [ ] Character variants remain visually consistent.
- [ ] Illustrations are reusable and have appropriate accessibility treatment.
- [ ] Assets are used in at least one real product surface before expanding the family.
- [ ] Decorative artwork does not reduce operational clarity.

---

## M5 — Quality, Optimization & Governance

**Priority:** P1  
**Objective:** Make asset quality and ownership enforceable as the library grows.

### 5.1 Integrity validation

- [ ] Add a validation script that checks registry references against actual files.
- [ ] Detect missing files and broken references.
- [ ] Detect duplicate files or likely duplicate content where practical.
- [ ] Validate file extensions and supported formats.
- [ ] Validate SVG files for parse errors and unsafe embedded content.
- [ ] Validate raster dimensions and report unusually large files.
- [ ] Validate font file presence and declared weights where practical.
- [ ] Validate required provenance / license information for distributable assets.
- [ ] Produce actionable errors that identify the file and the violated rule.

### 5.2 Optimization pipeline

- [ ] Define format guidance: SVG for suitable vector artwork; WebP / AVIF for suitable raster artwork; WOFF2 for web fonts.
- [ ] Preserve editable source artwork separately from optimized delivery output when appropriate.
- [ ] Add deterministic optimization scripts only for formats where they provide measurable value.
- [ ] Use an image optimization tool such as Sharp only if compatible with repository tooling and justified by actual assets.
- [ ] Avoid lossy optimization that damages line art, transparency, or character details.
- [ ] Avoid committing generated duplicates without a clear source/output policy.
- [ ] Record before/after sizes for optimization changes.
- [ ] Ensure optimized outputs remain visually acceptable.

### 5.3 Metadata and provenance

- [ ] Define the minimum metadata required for each asset category.
- [ ] Record creator / owner and original source.
- [ ] Record license or explicit usage permission; do not assume public availability means permission to redistribute.
- [ ] Record intended theme / surface applicability where relevant.
- [ ] Record alt text or decorative status for meaningful visual assets.
- [ ] Record tags only when they improve discovery or maintenance.
- [ ] Keep metadata close to the asset or its explicit registry declaration.
- [ ] Avoid a heavyweight metadata framework.

### 5.4 Governance and lifecycle

- [ ] Define who may add, replace, or deprecate canonical brand assets.
- [ ] Require review for changes to core logos, character identity, and licensed files.
- [ ] Define a deprecation process that preserves compatibility during migration.
- [ ] Document replacement asset IDs when an asset is deprecated.
- [ ] Establish reasonable file-size budgets by asset category.
- [ ] Add validation to CI after local validation is reliable.
- [ ] Document how to run validation and optimization locally.
- [ ] Ensure CI failures explain how to fix the asset issue.

### Acceptance criteria

- [ ] Validation catches missing registry files and malformed SVGs.
- [ ] Provenance and licensing are auditable.
- [ ] Optimization is repeatable and does not damage visual quality.
- [ ] Size budgets are documented and enforced where practical.
- [ ] CI can validate the asset library without requiring external network access.
- [ ] Asset deprecation does not silently break consumers.

---

## M6 — Ecosystem Adoption

**Priority:** P1  
**Objective:** Make the shared asset system the normal path across the monorepo.

### 6.1 UI integration

- [ ] Review `packages/ui` for locally duplicated brand marks, illustrations, and textures.
- [ ] Replace shared asset copies with package references where the integration is stable.
- [ ] Keep UI component styling and semantic theme tokens in `packages/ui`.
- [ ] Ensure assets do not create a dependency cycle.
- [ ] Update UI documentation with the asset consumption convention.
- [ ] Remove obsolete duplicates only after all consumers are migrated.

### 6.2 Headquarter integration

- [ ] Audit Headquarter for hard-coded shared asset paths and duplicated visual files.
- [ ] Adopt `@riotworks/assets` for applicable brand and shared illustration assets.
- [ ] Preserve Control mode readability across tables, forms, dashboards, and operational workflows.
- [ ] Use Riot mode artwork only on appropriate product surfaces.
- [ ] Verify route-level and production asset loading.
- [ ] Remove migrated duplicates after verification.

### 6.3 ARSY integration

- [ ] Audit ARSY for shared brand, icon, illustration, and texture assets.
- [ ] Adopt canonical shared assets where appropriate.
- [ ] Keep ARSY-specific visuals local when they are genuinely domain-specific.
- [ ] Ensure shared assets do not force ARSY to inherit unrelated page composition or UI behavior.
- [ ] Verify production build and visual consistency.

### 6.4 Documentation and rollout

- [ ] Publish usage examples for React applications.
- [ ] Document how to add a new asset from source to registry to application usage.
- [ ] Document how to add a theme variant safely.
- [ ] Document how to deprecate and replace an asset.
- [ ] Add a short asset review checklist for contributors.
- [ ] Record migration decisions and remaining exceptions.

### Acceptance criteria

- [ ] Headquarter and ARSY consume canonical shared assets where appropriate.
- [ ] No unnecessary duplicate copies remain for migrated assets.
- [ ] Application-specific artwork remains owned by the relevant application when justified.
- [ ] All consuming applications pass type-check and production build.
- [ ] The asset contribution and migration process is documented.

---

## 6. Cross-Cutting Quality Gates

These gates apply throughout implementation, not only at M5.

### Architecture

- [ ] No dependency from assets to UI or application packages.
- [ ] No database, CMS, remote asset registry, or unnecessary runtime schema.
- [ ] Public APIs are explicit, typed, and minimal.
- [ ] No hidden dynamic file discovery in production unless explicitly justified.

### Visual quality

- [ ] Follows `docs/10-design-dna.md` and `docs/11-design-system.md`.
- [ ] MOONWITNESS and RIOTWORKS identities are never conflated.
- [ ] Riot mode expression does not compromise Control mode usability.
- [ ] Textures and decorative effects preserve contrast and hierarchy.
- [ ] Original artwork has a traceable source and consistent style.

### Accessibility

- [ ] Meaningful images expose appropriate alternative text.
- [ ] Decorative images are hidden from assistive technology.
- [ ] Color is not the only carrier of meaning.
- [ ] Motion assets respect reduced-motion preferences in their consuming context.
- [ ] Assets do not obscure focus indicators or readable content.

### Engineering

- [ ] Type-check and build pass.
- [ ] Registry and integrity tests pass.
- [ ] Production asset paths are verified.
- [ ] No broken or orphaned registry references.
- [ ] No unlicensed or unverified third-party assets are bundled.
- [ ] Optimization is reproducible and reviewable.

---

## 7. Dependency & Execution Rules

1. Complete M1 before building public runtime APIs.
2. Complete the minimal M2 registry and resolution path before broad asset production.
3. M3 establishes the canonical visual baseline; do not create a large M4 library before this baseline is approved.
4. M5 validation should be introduced incrementally as soon as the relevant asset categories exist; do not postpone all quality checks until the end.
5. M6 migration must be incremental and must preserve working application builds.
6. A milestone is complete only when its acceptance criteria pass—not merely when files have been created.
7. Keep each implementation change small enough to review and validate.
8. Update this checklist as tasks are completed; do not mark work complete based on intention.

---

## 8. Explicit Non-Goals

The following are out of scope unless a separately approved requirement changes the direction:

- [ ] Building a CMS or graphical asset-management dashboard.
- [ ] Storing static repository assets in a database.
- [ ] Creating a dynamic remote registry service.
- [ ] Managing user uploads, tenant media, or operational attachments.
- [ ] Replacing the UI component library.
- [ ] Reimplementing Lucide or another functional icon set.
- [ ] Creating a universal design-token system inside the assets package.
- [ ] Generating large volumes of decorative artwork without product use cases.
- [ ] Making all applications visually identical regardless of their context.

---

## 9. Definition of Done

The asset foundation is considered production-ready when:

- [ ] The package is a first-class workspace package with stable public exports.
- [ ] Canonical assets are stored and referenced from one maintained location.
- [ ] Static registry and resolution behavior are typed, deterministic, and tested.
- [ ] Brand identity boundaries are explicit.
- [ ] The initial visual foundation follows the project's design DNA.
- [ ] Asset provenance, licensing, accessibility, and optimization rules are documented and validated.
- [ ] Headquarter, ARSY, and UI can consume shared assets without circular dependencies.
- [ ] Production builds resolve assets correctly.
- [ ] Contributor documentation explains how to add, review, use, and deprecate assets.

---

## 10. Reference Documents

- [Design DNA](../../docs/10-design-dna.md)
- [Design System](../../docs/11-design-system.md)
- [Shared UI package](../ui/)
- [Headquarter application](../../apps/headquarter/)
- [ARSY application](../../apps/arsy/)

---

**Guiding principle:** Own the visual resources. Declare them explicitly. Reuse them consistently. Keep the system boring and reliable underneath, so the visual identity can be bold on the surface.
