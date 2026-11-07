# MOONWITNESS Signal — Original Typography

**Status:** Prototype 0.1; original display font compiled and integrated. Full family remains in development.

## Design intent
MOONWITNESS Signal combines observatory precision, editorial authority, and lunar geometry. The first cut is a geometric monoline display face with squared corners, open apertures, a slashed zero, and custom M/W/N forms.

## Family architecture
- **Signal Display:** original custom font for uppercase headings, identity statements, and short display labels.
- **Signal Text:** native system UI sans fallback for paragraphs, controls, and long-form reading.
- **Signal Instrument:** native system monospace fallback for identifiers, timestamps, coordinates, and tabular data.

## Delivered prototype
- `MOONWITNESS-SignalDisplay-SemiBold.woff2` — bundled display font, weight 600.
- `source/moonwitness-signal-glyphs.json` — editable vector-stroke source for 53 glyphs.
- `source/build_signal_font.py` — reproducible FontTools builder; emits WOFF2 and a local TTF build.
- The font maps lowercase Latin to the uppercase display glyphs intentionally; use it for display/headline contexts, not body text.

## Current coverage and limitations
The prototype covers A–Z, 0–9, common punctuation, and lowercase codepoints mapped to uppercase. It does **not** yet contain distinct lowercase forms, Indonesian diacritics, extended Latin, or a complete typographic punctuation set. Browser shaping, hinting, cross-platform rendering, and full product visual QA remain release gates.

## Rebuild
Run `python -m pip install -r requirements-font-build.txt`, then `python source/build_signal_font.py` from this directory. Keep the JSON glyph source, builder, dependency pins, and generated font in the same change.

## Rights
The font source and binaries are original project-authored starting work. They remain **UNLICENSED / internal project use only** pending owner licensing decision. Do not redistribute externally or treat this note as legal advice.
