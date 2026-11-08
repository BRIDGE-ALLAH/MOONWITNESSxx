# MOONWITNESS typography assets

This folder contains an experimental custom display-font prototype. **The prototype is not part of the current product runtime.**

## Current product runtime

- The shared UI stylesheet uses **Space Grotesk** for display/interface typography.
- It uses **IBM Plex Mono** for technical data.
- Both use documented system fallback stacks.
- The current stylesheet does not declare an `@font-face` for MOONWITNESS Signal and does not load the committed WOFF2 file.

This matches the current typography direction in `docs/10-design-dna.md` and `docs/11-design-system.md`.

## Experimental prototype files

- `MOONWITNESS-SignalDisplay-SemiBold.woff2` — compiled prototype artifact, weight 600; not loaded by the product stylesheet.
- `source/moonwitness-signal-glyphs.json` — editable vector-stroke source for 53 glyphs.
- `source/build_signal_font.py` — reproducible FontTools builder.
- `requirements-font-build.txt` — pinned build dependencies.
- Build command: `python source/build_signal_font.py`.

The builder emits WOFF2 and TTF outputs. The tracked WOFF2 is retained as an internal design experiment; the TTF is a local build artifact.

## Coverage and release gates

The prototype contains uppercase Latin, digits, common punctuation, and lowercase codepoints mapped to uppercase. It does not provide distinct lowercase glyphs, Indonesian diacritics, extended Latin, complete punctuation, or a full typographic family. Browser shaping, hinting, cross-platform rendering, and full product visual QA remain open.

Do not switch the product runtime to this font until the owner approves its use, the required glyph coverage is complete, and browser/platform QA passes.

## Rights

The font and vector artwork are original project-authored starting assets and remain **UNLICENSED / internal project use only** pending owner approval. Do not redistribute externally. The historical `OFL-1.1.txt` file is research evidence, not a license grant for this custom font.
