# RIOTWORKS UI Token Contract

**Status:** Initial implementation — contrast review and rendered-theme verification pending.  
**Owner:** `packages/ui`  
**Brand source:** `docs/10-design-dna.md` and `docs/11-design-system.md`

## Rules

1. Components consume semantic tokens, not hard-coded brand colors.
2. Brand palette tokens (Obsidian, Paper Bone, Acid Lime, Riot Orange, Electric Blue, Riot Pink) are for brand expression; status tokens communicate system meaning.
3. Night Riot and Paper Riot are intentionally authored themes, not simple color inversions.
4. Status must never be communicated by color alone. Pair it with text, iconography, or shape.
5. Keep operational surfaces calm. Reserve high-energy textures and expressive color for focal areas.
6. Do not add arbitrary spacing values when the 4px-based Tailwind spacing scale is sufficient.
7. Respect `prefers-reduced-motion`; motion is feedback, never a prerequisite for understanding state.

## Theme switching

The host application owns theme selection and applies the `.dark` class to the document root (or an ancestor containing the UI). The package stylesheet defines semantic CSS variables for both modes.

```tsx
import '@riotworks/ui/styles'
```

## Semantic color tokens

All color variables are HSL channel values and are consumed using `hsl(var(--token))`.

| Token | Purpose |
|---|---|
| `background`, `foreground` | Main canvas and primary text |
| `card`, `card-foreground` | Card surface and content |
| `popover`, `popover-foreground` | Floating surface and content |
| `primary`, `primary-foreground` | Main action |
| `secondary`, `secondary-foreground` | Secondary action/surface |
| `accent`, `accent-foreground` | Brand emphasis, not status |
| `success`, `success-foreground` | Successful/completed state |
| `warning`, `warning-foreground` | Caution / attention required |
| `danger`, `danger-foreground` | Destructive / failed / critical state |
| `info`, `info-foreground` | Informational state |
| `neutral`, `neutral-foreground` | Neutral state |
| `muted`, `muted-foreground` | Low-emphasis surface and text |
| `border`, `border-strong`, `border-subtle` | Default, emphasized, and quiet boundaries |
| `input`, `ring`, `focus` | Form boundary and keyboard focus |
| `disabled`, `selected` | Disabled and selected interaction states |

The legacy `destructive` token aliases `danger` for compatibility with shadcn-based components.

## Surface hierarchy

| Token | Use |
|---|---|
| `surface-canvas` | Application/page background |
| `surface-elevated` | Elevated cards and floating content |
| `surface-panel` | Primary work panels |
| `surface-secondary` | Secondary panels and grouped regions |
| `surface-inset` | Recessed inputs, wells, and embedded areas |
| `surface-overlay` | Dialog/popover surface |
| `surface-scrim` | Modal backdrop; use with alpha in the consuming component |

Tailwind utilities are exposed as `bg-surface-canvas`, `bg-surface-panel`, `bg-surface-inset`, and related names.

## Typography

| Role | Font | Usage |
|---|---|---|
| Display | Archivo Black / fallback stack | Brand/editorial display headings |
| UI | Space Grotesk / fallback stack | Interface copy, navigation, forms |
| Mono | IBM Plex Mono / fallback stack | IDs, timestamps, technical metadata, metrics |

Do not use display typography for dense table cells, long paragraphs, or critical form labels. Prefer readable UI or mono roles according to content.

## Spacing, shape, and density

- Use Tailwind's default spacing scale, based on 4px increments.
- Do not redefine spacing globally in the UI preset; consumers may extend the scale deliberately.
- Default control radius: `--radius-control`.
- Panel radius: `--radius-panel`.
- Avoid pill-shaped containers unless the control semantics call for one.
- Density variants belong to component APIs (for example `density="compact"`), not global scaling hacks.

## Motion

| Token | Value | Intended use |
|---|---:|---|
| `motion-duration-fast` | 120ms | Hover/focus feedback |
| `motion-duration-standard` | 180ms | Common state transitions |
| `motion-duration-slow` | 260ms | Deliberate panel/overlay transitions |
| `motion-easing-standard` | cubic-bezier(0.2, 0, 0, 1) | Standard transition curve |

Tailwind aliases: `duration-fast`, `duration-standard`, `duration-slow`, and `ease-riot`.

The stylesheet applies a reduced-motion fallback. Components with meaningful motion must still use semantic end states and avoid motion-dependent information.

## Tailwind examples

```tsx
<div className="bg-surface-panel border-border-strong text-foreground">
  <span className="bg-success text-success-foreground">Completed</span>
  <span className="bg-warning text-warning-foreground">Needs review</span>
  <span className="bg-danger text-danger-foreground">Blocked</span>
</div>
```

## Verification still required

- [ ] Render both themes in Headquarter and inspect all core surfaces.
- [ ] Measure text and non-text contrast against WCAG 2.2 AA requirements.
- [ ] Verify primary/accent/status foreground combinations, including hover/disabled states.
- [ ] Verify focus ring visibility on canvas, panel, inset, and overlay surfaces.
- [ ] Confirm all token utilities are generated by the consumer Tailwind content scan.
- [ ] Review external font hosting and licensing; production should prefer approved self-hosted assets or a deliberate font provider policy.
