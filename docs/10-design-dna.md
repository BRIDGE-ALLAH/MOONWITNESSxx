# 10 — RIOTWORKS Design DNA

**Status:** Approved brand direction  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Creative thesis

RIOTWORKS must look like the creative operations wing of MoonWitness: a place where underground art culture meets a serious, futuristic production system.

**Art direction:** EXTREME RIOT + ORIGINAL MOONWITNESS COMIC + INDUSTRIAL BRUTALISM + PREMIUM GAME HUD + PUNK ZINE.

Reference the visual languages of punk photocopy zines, underground comics, street graphics, editorial brutalism, and industrial control rooms. Do not copy any specific artist, comic franchise, game UI, or protected artwork.

## 2. The five visual forces

### PUNK ZINE
Photocopy grain, torn paper, imperfect ink, collage, cutout type, visible print texture.

### UNDERGROUND COMIC
Original characters, bold outlines, halftone, panel composition, expressive scenes, action marks.

### NEO-BRUTALISM
Strong geometry, hard borders, deliberate asymmetry, graphic hierarchy, confident negative space.

### PREMIUM GAME HUD
Operational status, contextual panels, crisp metrics, focused motion, tactical information density.

### INDUSTRIAL FUTURISM
Technical labels, mechanical details, diagrammatic marks, workshop surfaces, engineered precision.

Street/Pop Art is the expressive accent layer.

## 3. Design tension

RIOTWORKS must balance two modes:
- **Riot mode:** expressive artwork, campaign headers, discovery, storytelling, product creation.
- **Control mode:** readable data, finance, tables, forms, approvals, policy, errors, and audit trails.

Do not make every screen loud. Use high-energy compositions for focal zones and calm operational surfaces for work that demands accuracy.

## 4. Core palette

| Token | Value | Role |
|---|---|---|
| Obsidian | #111315 | Main dark canvas |
| Deep Industrial | #191C1E | Dark secondary surface |
| Panel Charcoal | #24282A | Dark panel |
| Paper Bone | #F3EBDD | Light canvas |
| Acid Lime | #D2FF38 | Signature accent |
| Riot Orange | #FF542D | Action and creative energy |
| Electric Blue | #40D9FF | Informational accent |
| Riot Pink | #F047A4 | Expressive accent |
| Muted Ink | #777A76 | Supporting text / markings |

Use semantic colors separately for success, warning, danger, and neutral. Brand color is not a substitute for semantic status.

## 5. Typography DNA

- Display: heavy condensed, uppercase, oversized editorial titles.
- Interface: geometric sans with excellent readability.
- Technical: monospace for IDs, run states, dates, source metadata, and financial values.

Suggested families: Archivo Black or Anton; Space Grotesk; IBM Plex Mono. Use fallback stacks and verify licensing/hosting before shipping font files.

## 6. Composition

- Use asymmetrical grids selectively.
- Mix large title blocks with compact operational information.
- Use comic panels for narrative or production previews.
- Use hard-edged cards and borders where hierarchy benefits.
- Use deliberate whitespace to prevent visual fatigue.
- Use small annotation marks, index numbers, labels, and stamps as a coherent graphic vocabulary.
- Never place important information on noisy textures without a solid readable backing.

## 7. Texture rules

- Grain and halftone are low-opacity surface layers.
- Torn edges and distressed ink belong to decorative regions, not dense tables or form controls.
- Avoid full-screen noise and high-frequency animation.
- Use CSS patterns or original SVGs where practical.
- Texture must not reduce contrast, focus visibility, or screenshot legibility.

## 8. Brand behaviors

- Navigation feels like a compact creative command deck.
- Research feels like an evidence wall / investigation room.
- Product creation feels like a workshop.
- ZILL Watch feels like an inspection station.
- Finance feels like a precise ledger with restrained riot accents.
- Aftershock feels like an editorial performance analysis.

## 9. Forbidden shortcuts

- Generic blue-purple AI gradients.
- Generic white SaaS card grid everywhere.
- Random neon decoration.
- Default shadcn styling with only color changes.
- Random stock illustrations as core brand identity.
- Emoji used as permanent character art.
- Unreadable distressed fonts for operational labels.
- Decorative "HUD text" that looks like information but has no meaning.
- Copying a known game, comic, artist, or brand.
- Sacred words or imagery used as gimmicks.

## 10. Recognition test

A screenshot should be identifiable as RIOTWORKS from its typography, composition, texture, character language, palette, and panel design even if the logo is hidden.

## 11. Motion and sound

Motion:
- Comic panel reveal for selected transitions.
- Crisp panel slide and snap.
- Short status pulse for active work.
- Ink-stamp completion feedback.
- Restrained glitch only for deliberate storytelling, never for routine critical errors.
- Reduced-motion preference must be respected.

Sound:
- Optional mechanical click, paper impact, radio-static accent, short bass confirmation.
- Off by default or governed by explicit user preference.
- Never play automatically on page load.
- Every sound must have a mute control.

## 12. Theme direction

Create two intentionally designed themes:
- **Night Riot:** Obsidian, Deep Industrial, Acid Lime, high contrast.
- **Paper Riot:** Paper Bone, dark ink, controlled orange/lime accents, print/editorial feel.

Do not merely invert colors. Review component, chart, table, illustration, focus, hover, and disabled states in both themes.
