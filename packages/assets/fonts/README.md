# Typography assets and license record

## Approved font families

The two recommended families below are distributed under the SIL Open Font License 1.1 (OFL-1.1), according to their upstream project repositories and license files.

| Family | Role | Copyright notice | Upstream source |
|---|---|---|---|
| Space Grotesk | Display and interface | Copyright 2020 The Space Grotesk Project Authors | https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt |
| IBM Plex Mono | Technical / tabular data | Copyright © 2017 IBM Corp.; Reserved Font Name "Plex" | https://github.com/IBM/plex/blob/master/packages/plex-mono/fonts/complete/ttf/license.txt |

The complete OFL-1.1 text is stored in [OFL-1.1.txt](./OFL-1.1.txt). Keep each font's copyright notice and this license alongside any future font binaries. IBM Plex's reserved font name must be respected; do not rename modified derivatives to "Plex" without permission.

## Hosting and redistribution decision

OFL-1.1 permits use, embedding, bundling, and redistribution of covered font software with software, provided the copyright notice and license accompany each copy, the font is not sold by itself, and modified font software remains under OFL-1.1. This is a license-level review, not a legal opinion or confirmation of every upstream file's provenance.

**Decision:** the family licenses are verified for a future compliant self-hosted bundle. Font binaries are intentionally not copied into this repository in this milestone; current CSS stacks remain functional with system fallbacks. A future binary import must pin an upstream release/commit, include the family-specific notice and OFL text, record file hashes and source URLs, and run font subsetting/coverage checks before deployment.

## Design roles

- Display / interface: Space Grotesk, weights 400–700.
- Technical / metrics: IBM Plex Mono, weights 400–500.
- Fallbacks remain in `packages/ui/tailwind.config.js`; do not rely on remote font CSS as a production dependency.
