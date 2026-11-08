# MOONWITNESS Brand Kit v1.2

## Master identity

**MOONWITNESS is the master product brand.** It owns the name, symbol, wordmark, Core Promise, Manifesto, and visual grammar.

**RIOTWORKS is the product and operating division within MOONWITNESS**, initially associated with creative-commerce workflows. It is not an independent master brand in the MOONWITNESS product lockup. The `@riotworks/*` package scope is an internal technical namespace and does not require RIOTWORKS to appear in public UI.

- **Core Promise:** SEE MORE. KNOW MORE.
- **Brand Manifesto:** WHEN THE MOON RISES, WE SHARE MESSAGES. (WMR-WSM)
- **Operational verbs:** OBSERVE · RECORD · VERIFY · CONNECT · UNDERSTAND · SHARE
- **Primary mark:** lunar aperture + orbital path + witness star.
- **Primary lockup:** symbol + MOONWITNESS wordmark + Core Promise.
- **Manifesto placement:** use as a supporting editorial/campaign line, not inside compact logo lockups.

## Narrative meaning

- **Moon:** changing perspective, cycles, timing, reflection, and illumination—not horoscope, occult symbolism, or supernatural product claims.
- **Witness:** accountable observation and provenance—not surveillance or an all-seeing eye.
- **Signal:** a meaningful observation that deserves attention—not fabricated urgency or pseudo-telemetry.
- **Message:** information shared with source, context, and uncertainty.
- **Archive:** memory that can be inspected, corrected, and retrieved.

## Experience skins

All skins use the same MOONWITNESS master identity. They are visual experiences, not sub-brands.

| Skin | Role | Core visual language |
|---|---|---|
| Observatory | Operational / research | Dark cinematic instrument, measured grids, lunar geometry |
| Archive | Reading / evidence / knowledge | Warm paper, editorial hierarchy, provenance and archival rules |
| Signal | Public storytelling / onboarding / community | Moonpunk editorial, poster typography, restrained halftone and manga-line energy |

Do not create a different master logo for each skin. Signal is not a ROCKSOUL or RIOTWORKS rebrand.

## Logo files

- `assets/brand/moonwitness-symbol.svg` — symbol only; use for app icon/avatar after testing at target sizes.
- `assets/brand/moonwitness-wordmark.svg` — wordmark only.
- `assets/brand/moonwitness-lockup.svg` — primary horizontal lockup with Core Promise and a supporting Manifesto line.
- `assets/brand/moonwitness-seal.svg` — archival/editorial stamp; not the primary logo.

All SVGs use controlled MOONWITNESS brand colors. Preserve proportions, keep clear space at least the width of the star detail, and do not stretch, rotate, add glow, or place over noisy backgrounds.

## Messaging usage

Use the Core Promise wherever the product identity needs to be immediately understood. Use the Manifesto where the human/community purpose can be given room. Avoid repeating both lines in every interface component.

## Palette and typography

Import `brand-tokens.css` as a reference layer. Product skins must map brand primitives into semantic tokens rather than use raw brand values everywhere.

- Display: Space Grotesk 600–700 (fallback Arial/system sans-serif).
- Body/UI: Space Grotesk 400–600 (fallback system sans-serif).
- Technical: IBM Plex Mono 400–500 (fallback system monospace).
- A licensed editorial serif may be used selectively for long-form storytelling; it is not a required runtime dependency.

Space Grotesk and IBM Plex Mono are documented upstream as SIL Open Font License 1.1 families. See `fonts/README.md` and `fonts/OFL-1.1.txt` for the license record and conditions. Font binaries remain intentionally unbundled until a pinned upstream release, source hashes, family-specific copyright notices, and reproducible import are recorded.

The experimental MOONWITNESS Signal WOFF2 is not approved for runtime use or redistribution until glyph coverage, rights, owner approval, and browser/platform QA are complete.

## Artwork and texture

Original SVG assets in this package are repository-authored starting artwork.

- Observatory: restrained lunar contours, orbital grid, and technical rules.
- Archive: paper grain, archival separators, and document-oriented illustration.
- Signal: original print/halftone/manga-line illustration and poster devices, used selectively.

Keep texture away from dense data, body text, status indicators, focus rings, and form controls. Meaningful artwork needs alt text; decorative patterns must be hidden from assistive technology.

## Rights and status

The source SVGs are original project assets. Their status remains **UNLICENSED / internal project use only** until the repository owner declares an explicit license and confirms ownership/assignment. Do not redistribute externally or treat this note as legal advice.

References to historic MOONWITNESS/XIV/XV work, ROCKSOUL art, or external poster styles are research inputs—not permission to reproduce protected artwork, logos, or characters.
