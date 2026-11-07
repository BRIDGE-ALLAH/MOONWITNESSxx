# MOONWITNESS / RIOTWORKS — Visual DNA

> **SEE MORE. KNOW MORE.**  
> *When the moon rises, we share messages.*

This is the visual contract for the shared UI. The goal is not a generic neon dashboard. MOONWITNESS should feel like a living signal observatory: nocturnal, alert, editorial, tactile, and precise.

## The five signatures

1. **Nocturnal intelligence** — deep graphite surfaces, controlled pools of light, and clear depth. Night Riot is the expressive default for command environments; Paper Riot keeps the same hierarchy in a warm, high-clarity reading mode.
2. **Signal energy** — acid lime means active signal or primary action; riot orange is a deliberate alert/accent; electric blue is reserved for information and focus. Never use all accents at once.
3. **Editorial scale** — oversized condensed display typography for moments of orientation, compact mono labels for telemetry, and a calm UI face for sustained reading.
4. **Instrument language** — coordinates, indices, timestamps, fine rules, grids, orbital arcs, and status lamps communicate structure. Motifs must support orientation or state, not become wallpaper.
5. **Living, not noisy** — motion communicates arrival, progress, or state change. Ambient motion is slow and low contrast; interaction feedback is quick. Reduced-motion users receive the same information without animation.

## Composition recipe

- Start with one strong page statement, one short explanation, and one clear primary action.
- Use a large canvas with a small number of purposeful surfaces. Reserve the strongest glow for one focal point.
- Build depth with surface contrast, hairline borders, edge highlights, and restrained radial light—not stacks of drop shadows.
- Use RiotSignalHeader to establish editorial hierarchy and RiotLiveIndicator for explicit live/standby/attention state.
- Use RiotAtmosphere only on hero or entry regions. Do not wrap every card in ambient effects.
- Keep operational data dense and calm. Do not animate values continuously or imply live data when the host has not supplied it.

## Motion contract

| Motion | Purpose | Default | Reduced motion |
|---|---|---:|---|
| Signal pulse | Indicate a live state | 2.4s, subtle | Static dot |
| Ambient drift | Add depth to hero canvas | 24s, low contrast | Static light |
| Hover/focus | Confirm interaction | 120–180ms | Immediate |
| Page reveal | Establish hierarchy | 180–260ms | Immediate |

Do not use autoplay video, flashing, parallax, cursor-following effects, or infinite movement on data-heavy screens. Respect prefers-reduced-motion.

## Color and typography

- **Night Riot:** obsidian/graphite base, bone text, acid-lime signal, orange alert.
- **Paper Riot:** warm bone canvas, ink text, dark lime action, orange accent.
- Display: Archivo Black with robust system fallbacks.
- UI: Space Grotesk with system fallbacks.
- Telemetry: IBM Plex Mono with system fallbacks.

The current fonts are remotely loaded from Google Fonts. Before production launch, confirm licensing, privacy/performance requirements, and whether to self-host. The fallback stack must remain legible if the remote font request fails.

## Anti-patterns

- Neon glow on every element.
- Glassmorphism that reduces text contrast.
- Decorative animation that looks like real telemetry.
- Color-only status communication.
- Huge headings on every screen.
- Motion that cannot be disabled.
- Brand motifs that make tables/forms harder to scan.

## Quality promise

Cinematic is the entry impression; clarity is the lasting impression. A MOONWITNESS screen must remain fast, keyboard-operable, readable, and calm under real operational load.


## Signature experiences — the observatory layer

### Signal Constellation
A relationship field turns a list of disconnected signals into an inspectable map. The visual metaphor is a star chart, but the interaction is evidence-first:
- A node is a host-provided signal, not an automatically inferred truth.
- A connecting line is a host-provided relationship; the component never invents edges.
- Selecting a node reveals its description, provenance, observation time, evidence, and optional confidence.
- Confidence is shown only when supplied. It must not be presented as probability unless the host defines and documents its calibration.

### Decision Trail
Decision Trail makes change legible. It is a human-readable sequence of events, with an inspector for rationale and evidence. It is not an audit ledger, event store, or tamper-proof record. Those guarantees belong to backend infrastructure.

### The design principle
**Make the invisible inspectable.** The interface should expose the relationship, source, uncertainty, and reason behind an important state—not merely decorate a number. If provenance is absent, omit it rather than filling the gap with plausible-looking metadata.
