# @riotworks/assets

The canonical, source-controlled visual asset library for MOONWITNESS / RIOTWORKS.

## Responsibilities

- Own approved, repository-managed visual resources.
- Expose a small, statically declared TypeScript registry.
- Provide lightweight React helpers for rendering approved assets.
- Keep provenance, licensing, accessibility, and theme applicability close to each declaration.
- Provide validation for missing, malformed, oversized, or unsafe SVG resources.

This package is **not** a CMS, database, remote asset service, user-upload store, or replacement for `@riotworks/ui`.

## Package boundaries

- `@riotworks/assets`: artwork, static registry, asset metadata, resolution, asset rendering helpers.
- `@riotworks/ui`: reusable interface primitives, interactions, semantic theme tokens, and compositional UI.
- Applications: page composition, domain behavior, permissions, and user-generated content lifecycle.

Dependency direction is one-way: UI may depend on assets; assets must never depend on UI.

MOONWITNESS and RIOTWORKS remain separate brand identities. Do not substitute one identity's marks for the other.

## Usage

```tsx
import { Illustration, Texture } from "@riotworks/assets";

<Illustration name="illustration.empty-search" />
<Texture name="texture.halftone" opacity={0.04} />
```

For an image used outside the provided helpers:

```tsx
import { getAsset } from "@riotworks/assets";

const emptySearch = getAsset("illustration.empty-search");
// Use emptySearch.src with the host framework's image component.
```

Asset URLs are declared with static `new URL(relativePath, import.meta.url)` expressions so supported bundlers can discover and emit the files. Verify production output whenever adding a new consumer or changing the build pipeline.

## Add an asset

1. Add the original source file under the matching `assets/` category.
2. Use lowercase kebab-case filenames.
3. Add an explicit entry to `src/registry.ts`; do not rely on hidden directory scanning.
4. Include a meaningful description, source, license / usage permission, theme, tags, dimensions, and accessibility treatment.
5. Run `pnpm --filter @riotworks/assets validate`, `pnpm --filter @riotworks/assets test`, and `pnpm --filter @riotworks/assets type-check`.
6. Review the asset in both Night Riot and Paper Riot surfaces where relevant.

## Ownership and licensing

Current starter textures and illustrations are original repository assets marked **UNLICENSED / internal use**. This repository currently has no declared root license; do not redistribute these assets externally until the project owner confirms the intended rights and license.

Do not add third-party fonts, logos, characters, or artwork without recording their source and explicit redistribution / usage permission. Existing design references are direction, not permission to copy protected artwork.

## Asset policy

- SVG is preferred for suitable vector artwork and repeatable textures.
- Raster formats should be introduced only when artwork benefits from raster delivery; add optimization tooling when there is a real raster workload.
- Functional UI icons remain the responsibility of the existing functional icon library (Lucide in the current UI package). Do not duplicate it here.
- Meaningful illustrations need alt text; decorative textures are hidden from assistive technology.
- Keep textures subtle and away from dense operational content, focus indicators, and critical information.
- User uploads, tenant media, and operational documents belong to application/backend storage—not this package.

## Validation

`pnpm --filter @riotworks/assets validate` checks registry/file integrity, SVG safety, metadata, and file-size limits.

`pnpm --filter @riotworks/assets test` runs the registry integrity tests using Node's built-in test runner. No external service is required.
