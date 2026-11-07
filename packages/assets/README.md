# @riotworks/assets

The source-controlled visual asset library for MOONWITNESS applications and the separately governed RIOTWORKS studio identity.

## Brand ownership

**MOONWITNESS is the master product brand.** Its canonical identity, brand DNA, and usage rules are documented in [docs/10-design-dna.md](../../docs/10-design-dna.md), [docs/12-brand-architecture.md](../../docs/12-brand-architecture.md), and [BRAND.md](./BRAND.md).

RIOTWORKS is an independent creative/engineering studio identity. It is not the MOONWITNESS master brand and must not appear in MOONWITNESS product lockups by default. Keep studio marks, artwork, and tokens separately governed.

## Responsibilities

- Own original, repository-managed visual resources.
- Expose a small, statically declared TypeScript registry.
- Provide lightweight React helpers for rendering approved assets.
- Keep provenance, licensing, accessibility, and theme applicability close to each declaration.
- Validate missing, malformed, oversized, or unsafe SVG resources.

This package is **not** a CMS, database, remote asset service, user-upload store, or replacement for `@riotworks/ui`.

## Package boundaries

- `@riotworks/assets`: artwork, brand assets, static registry, metadata, resolution, asset rendering helpers.
- `@riotworks/ui`: reusable interface primitives, interactions, semantic theme tokens, and compositional UI.
- Applications: page composition, domain behavior, permissions, and user-generated content lifecycle.

Dependency direction is one-way: UI may depend on assets; assets must never depend on UI.

## Usage

```tsx
import { Illustration, Texture } from "@riotworks/assets";

<Illustration name="illustration.observation-desk" />
<Texture name="texture.lunar-contours" opacity={0.04} />
```

For a brand asset, use `getAsset("brand.lockup")` or the `AssetImage` helper with the registered ID supported by the component API.

Asset URLs are declared with static `new URL(relativePath, import.meta.url)` expressions so supported bundlers can discover and emit the files. Verify production output whenever adding a new consumer or changing the build pipeline.

## Asset categories

- `brand/`: master symbol, wordmark, lockups, and archive seal.
- `illustrations/`: original editorial and observatory artwork.
- `textures/`: lunar contours, orbital grid, and existing neutral textures.
- `patterns/`: archival rules and repeatable editorial surfaces.

Functional UI icons remain the responsibility of the existing functional icon library. Do not duplicate it here.

## Add an asset

1. Add the original source file under the matching `assets/` category.
2. Use lowercase kebab-case filenames.
3. Add an explicit entry to `src/registry.ts`; do not rely on hidden directory scanning.
4. Include a meaningful description, source, license / usage permission, theme, tags, dimensions, and accessibility treatment.
5. Run `pnpm --filter @riotworks/assets validate`, `pnpm --filter @riotworks/assets test`, and `pnpm --filter @riotworks/assets type-check`.
6. Review the asset in both dark observatory and warm editorial surfaces where relevant.

## Typography

The brand kit recommends Space Grotesk for display/interface and IBM Plex Mono for technical data. Font binaries are intentionally not bundled until font licenses and hosting/redistribution rights are verified. See `brand-tokens.css` for fallback stacks.

## Ownership and licensing

The new brand marks, textures, patterns, and illustrations are original repository-authored starting assets. Their status remains **UNLICENSED / internal project use only** until the repository owner declares rights and an explicit license. Do not redistribute externally until that is resolved.

Reference repositories are research inputs, not permission to copy their logos, characters, or artwork. Do not add third-party fonts, logos, characters, or artwork without recording their source and explicit redistribution / usage permission.

## Accessibility and safety

- Meaningful illustrations need alt text; decorative textures are hidden from assistive technology.
- Keep textures subtle and away from dense operational content, focus indicators, and critical information.
- User uploads, tenant media, and operational documents belong to application/backend storage—not this package.

## Validation

`pnpm --filter @riotworks/assets validate` checks registry/file integrity, SVG safety, metadata, and file-size limits.

`pnpm --filter @riotworks/assets test` runs registry integrity tests using Node's built-in test runner. No external service is required.
