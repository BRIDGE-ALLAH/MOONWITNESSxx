# MOONWITNESS typography assets

The identity uses original vector lettering and the in-house **MOONWITNESS Signal** display font.

## Runtime
- `MOONWITNESS-SignalDisplay-SemiBold.woff2` — original display font, weight 600, loaded by the shared UI stylesheet.
- The wordmark and MW monogram remain outlined SVG paths and do not depend on fonts.
- Signal Text uses native platform UI sans; Signal Instrument uses native system monospace.
- The display font maps lowercase characters to uppercase forms and is for headings/short display copy only. Do not use it for body text or dense tables.

## Editable source and build
- Glyph source: `source/moonwitness-signal-glyphs.json`
- Builder: `source/build_signal_font.py`
- Pinned build dependencies: `requirements-font-build.txt`
- Build command: `python source/build_signal_font.py`

The builder emits WOFF2 and TTF outputs. The committed WOFF2 is the browser runtime asset; the TTF is a local build artifact.

## Coverage and release gates
The prototype contains uppercase Latin, digits, common punctuation, and lowercase codepoints mapped to uppercase. Distinct lowercase glyphs, Indonesian diacritics, extended Latin, kerning refinement, browser shaping, hinting, and cross-platform QA remain open.

## Rights
The font and vector artwork are original project-authored starting assets and remain UNLICENSED / internal project use only pending owner approval. The old `OFL-1.1.txt` is a historical research record; Space Grotesk and IBM Plex Mono are not runtime dependencies.
