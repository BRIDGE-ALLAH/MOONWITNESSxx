# MOONWITNESS Signal — Original Typography

**Status:** Prototype 0.1; compiled source experiment, **not integrated into the current product runtime**. The full family remains incomplete.

## Design intent

MOONWITNESS Signal explores observatory precision, editorial authority, and lunar geometry. The first cut is a geometric monoline display face with squared corners, open apertures, a slashed zero, and custom M/W/N forms.

## Current integration status

- The shared UI stylesheet uses Space Grotesk for display/interface roles and IBM Plex Mono for technical data, with system fallbacks.
- The stylesheet does not declare or load MOONWITNESS Signal through `@font-face`.
- The committed WOFF2 is an experimental repository artifact, not a production runtime dependency or approved distribution asset.

Do not change the current product font mapping to this prototype without owner approval and completion of the release gates below.

## Delivered prototype

- `MOONWITNESS-SignalDisplay-SemiBold.woff2` — compiled display-font prototype, weight 600.
- `source/moonwitness-signal-glyphs.json` — editable vector-stroke source for 53 glyphs.
- `source/build_signal_font.py` — reproducible FontTools builder; emits WOFF2 and a local TTF build.
- The prototype maps lowercase Latin codepoints to uppercase display glyphs; it is intended only for short display/headline contexts if eventually approved.

## Current coverage and limitations

The prototype covers A–Z, 0–9, common punctuation, and lowercase codepoints mapped to uppercase. It does **not** yet contain distinct lowercase forms, Indonesian diacritics, extended Latin, or a complete typographic punctuation set. Browser shaping, hinting, cross-platform rendering, and full product visual QA remain release gates.

## Rebuild

Run `python -m pip install -r requirements-font-build.txt`, then `python source/build_signal_font.py` from this directory. Keep the JSON glyph source, builder, dependency pins, and generated font in the same change.

## Rights

The font source and binaries are original project-authored starting work. They remain **UNLICENSED / internal project use only** pending an explicit owner licensing decision. Do not redistribute externally or treat this note as legal advice.
