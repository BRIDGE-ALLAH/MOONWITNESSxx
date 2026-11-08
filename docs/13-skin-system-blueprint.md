# 13 — MOONWITNESS Skin System Blueprint

**Status:** Proposed canonical design and architecture baseline; implementation not yet complete  
**Version:** 1.0  
**Date:** 2026-11-08  
**Owner:** `packages/ui`  
**Related:** [01 Ecosystem Narrative](./01-ecosystem-narrative.md), [10 Design DNA](./10-design-dna.md), [11 Design System](./11-design-system.md), [12 Brand Architecture](./12-brand-architecture.md), [Asset Brand Kit](../packages/assets/BRAND.md), [UI Token Contract](../packages/ui/DESIGN-TOKENS.md)

> One MOONWITNESS identity. Three visual experiences. One coherent interaction and evidence language.

## 1. Executive decision

MOONWITNESS will establish a first-party **Skin System** inside the existing shared UI package, `@riotworks/ui`.

A skin is a complete visual expression profile for a type of user experience. It affects composition, typography roles, spacing rhythm, density defaults, surface character, border/shape treatment, texture, illustration usage, and component recipes.

A skin is **not**:

- a light/dark toggle;
- a new logo, brand, or product;
- a random collection of CSS overrides;
- a user-generated theme editor;
- a license to change evidence, status, or accessibility semantics;
- an excuse to turn every screen into a HUD, poster, or visual showcase.

The first release defines exactly three experience skins:

1. `observatory` — cinematic operational instrument.
2. `archive` — warm evidence editorial.
3. `signal` — expressive Moonpunk editorial.

They all inherit the MOONWITNESS master identity and shared semantic contract.

## 2. Product narrative: why skins exist

MOONWITNESS exists to help people observe carefully, preserve meaningful messages, verify what can be checked, connect knowledge, and share discoveries with context.

The visual system must respond to the different mental states required by that work:

- When people **operate, monitor, compare, or decide**, they need a calm instrument that makes state and evidence legible.
- When people **read, research, remember, or retrieve**, they need an editorial archive that gives information room and preserves provenance.
- When people **discover, enter, participate, or share a story**, they need an expressive signal that creates curiosity and emotional entry without sacrificing truth.

One generic interface cannot serve these tasks equally well. Three unrelated visual brands would fragment the product. The Skin System is the middle path: distinct atmospheres, shared identity and behavior.

The metaphor remains consistent:

- Moon = perspective, cycles, timing, reflection, illumination.
- Witness = accountable observation, not surveillance.
- Signal = a meaningful observation that deserves attention, not an invented alert.
- Message = information shared with source, context, and uncertainty.
- Archive = memory that can be inspected, corrected, and retrieved.

The narrative is poetic, but implementation and evidence remain literal. The software does not claim omniscience, supernatural insight, or divine authority.

## 3. Foundational design principles

1. **One master brand:** every skin uses the MOONWITNESS symbol, wordmark, voice, and core promise.
2. **Task-led expression:** choose the skin according to the user's task, not novelty.
3. **Evidence before spectacle:** source, timestamp, confidence, and uncertainty remain legible.
4. **Distinct but related:** each skin has its own composition and material language, while sharing typography foundations, semantic roles, icon behavior, interaction patterns, and accessibility.
5. **No decorative falsification:** no fake data, fake coordinates, fake certification, fake status, or pseudo-scientific ornament.
6. **Respectful expression:** grunge, manga lines, halftone, and poster energy are used purposefully and never trivialize people, sacred symbols, or sensitive information.
7. **Accessibility is invariant:** no skin can weaken contrast, semantics, keyboard support, reduced motion, or responsive behavior.
8. **No premature multiplication:** start with three skins; add another only when a materially different user task proves it necessary.

## 4. Skin definitions and usage contract

### 4.1 Observatory — the instrument

**Skin key:** `observatory`  
**Visual role:** cinematic observatory + instrument brutalism  
**Primary appearance:** dark

Use for:

- Headquarter command and operational workspaces.
- System status, monitoring, activity, and job execution.
- Live observation, comparison, decision review, and technical inspection.
- Dense data views that need stable navigation and clear context.

Visual rules:

- Void canvas with layered Observatory and Slate surfaces.
- Moonlight for primary text; Lunar Silver for secondary information.
- Signal Gold for primary identity emphasis, focus, and selected attention—not success.
- Precise grids, stable columns, fine rules, measured orbital detail, and restrained depth.
- Dense views may use compact density, but row height and touch targets must remain usable.
- Data and evidence take priority over ornamental atmosphere.

Do not:

- fill the screen with fake HUD chrome or random coordinates;
- surround every metric with a separate card;
- animate charts or values to create false activity;
- use gold as a generic positive status.

### 4.2 Archive — the record

**Skin key:** `archive`  
**Visual role:** evidence archive + warm editorial  
**Primary appearance:** light

Use for:

- Long-form reading and knowledge articles.
- Source records, citations, provenance, and research history.
- Documentation, reports, notes, and retrievable memory.
- Comparison views where reading and traceability matter more than live status.

Visual rules:

- Moonlight paper surfaces and Deep Ink text.
- Editorial title, metadata, body, source, and footnote hierarchy.
- Restrained archival rules, indexes, page markers, marginal notes, and citation treatments.
- Comfortable line length and generous vertical rhythm.
- Use a licensed editorial serif only as a deliberate accent; body/interface readability remains stable.

Do not:

- simply invert Observatory colors and call it Archive;
- put grain behind long text;
- make document metadata look like official certification;
- hide provenance in a distant tab or decorative footer.

### 4.3 Signal — the message

**Skin key:** `signal`  
**Display expression:** **MOONPUNK SIGNAL**  
**Visual role:** expressive poster/editorial + human signal  
**Primary appearance:** contrast-led editorial; supported light/dark pairings must be explicitly verified

Use for:

- Public product entry and landing experiences.
- Onboarding introductions and feature discovery.
- Community, campaign, release, and editorial storytelling.
- Selected creative-commerce presentation where the visual story is the main task.

Visual rules:

- Strong typographic scale, compact headline systems, bold negative space, and asymmetrical composition.
- Controlled poster blocks, print grain, restrained halftone, manga motion lines, paper cuts, ink marks, and original illustration.
- High-impact accents may use Signal Red, Eclipse Violet, and Signal Gold; semantic status tokens remain unchanged.
- Use a small number of visual effects per composition. Let one expressive device lead.
- Keep the primary action, meaning, ownership, and source context immediately understandable.

Do not:

- use poster layouts for security, billing, dense tables, operational monitoring, or lengthy transactional forms;
- use riot/acid-lime styling as the MOONWITNESS default;
- imitate another studio's logo, characters, or poster artwork;
- let motion lines, grain, or collage hide content or controls.

Signal is a MOONWITNESS expression. It is not a ROCKSOUL skin, a RIOTWORKS rebrand, or a separate visual identity.

## 5. Brand architecture and skin relationship

The relationship is:

```text
MOONWITNESS — master brand
├── Observatory — operational / research experience
├── Archive     — knowledge / record experience
└── Signal      — public / editorial / community experience
```

The wider ecosystem remains separate from this skin hierarchy:

- GODPROMISE is the vision and ethical commitment narrative.
- EMPIRE OF THE LIGHT is the wider universe.
- A-L-L-A-H.COM is the intended public home and gateway.
- ROCKSOUL is a distinct creative/narrative identity and runtime direction.
- RIOTWORKS is the MOONWITNESS product and operating division.
- ARSY is backend/application authority, not a visual skin.

Do not add these identities as skins. Do not create a new MOONWITNESS master logo for each product, app, skin, module, campaign, or program release.

## 6. Architecture: skin is not theme mode

Keep six concerns separate:

| Concern | Responsibility | Example |
|---|---|---|
| Brand identity | Stable name, mark, promise, palette primitives | MOONWITNESS / Signal Gold |
| Semantic tokens | Accessible meaning | background, foreground, focus, danger, verified |
| Skin | Visual grammar and component recipes | observatory, archive, signal |
| Appearance mode | Color presentation supported by a skin | dark, light |
| Density | Information spacing | comfortable, compact |
| Accessibility preferences | System/user requirements | reduced motion, contrast, zoom |

A skin may set a default mode and recommended density, but applications retain control over supported pairings. Accessibility preferences are never overridden by a skin.

### 6.1 Selection policy

- The application selects a route-appropriate skin as part of experience design.
- The route/task context takes precedence over a generic global skin preference where changing skin would reduce clarity.
- Appearance mode and density may be user preferences when the application exposes them and when the skin supports the pairing.
- Do not ship a global skin picker until all choices have documented use cases, verified pairings, persistence rules, and a clear reset path.
- Skin selection is never authorization. A hidden component remains protected by backend permission checks, not CSS or menu visibility.

### 6.2 Scope and attributes

The target implementation should scope a skin to an application or route root, not to arbitrary individual controls.

Proposed DOM contract:

```html
<div data-mw-skin="observatory" data-mw-mode="dark" data-mw-density="comfortable">
  <!-- application-owned page -->
</div>
```

Allowed initial skin values: `observatory`, `archive`, `signal`.  
Allowed initial mode values: `dark`, `light`, subject to the supported pairing matrix.  
Allowed density values: `comfortable`, `compact`.

These attributes are a design contract, not a statement that the current package has already implemented them. Keep compatibility with the existing `.dark`, `.theme-observatory`, and `.theme-archive` selectors during migration; remove compatibility selectors only after all consumers are updated.

## 7. Token layers and ownership

### 7.1 Brand primitives

Owned by `@riotworks/assets` and the approved brand documentation. These values describe MOONWITNESS identity; they are not directly scattered through application components.

### 7.2 Semantic tokens

Owned by `@riotworks/ui`. Required roles include:

- Text: primary, secondary, muted, inverse.
- Surface: canvas, panel, elevated, inset, overlay, scrim.
- Border: subtle, default, strong.
- Interaction: hover, pressed, focus, selected, disabled.
- Status: success, warning, danger, info, neutral, blocked.
- Evidence: verified, corroborated, unverified, disputed, insufficient, superseded.

Status and evidence vocabularies must remain separate.

### 7.3 Skin tokens

Owned by `@riotworks/ui`. Skin tokens may describe:

- display and heading scale;
- body and technical typography roles;
- surface hierarchy and material;
- spacing and layout rhythm;
- radius, border, elevation, and shadow;
- texture and decorative layer;
- component emphasis and composition recipes.

Avoid token explosion. Prefer a small set of stable semantic and skin roles over one-off per-page CSS variables.

### 7.4 Component tokens

Only create component-specific tokens when a stable, shared component requirement cannot be represented by semantic and skin tokens. Keep domain-specific visual meaning in application-owned composition where it does not generalize.

## 8. Component and package boundaries

### `@riotworks/ui`

Owns:

- semantic token definitions and supported skin profiles;
- shared React primitives and accessible interaction behavior;
- generic compositional patterns (form field, evidence panel, timeline, empty/error state);
- skin-aware visual recipes and a local skin workbench;
- tests for tokens, theme pairing, component states, and keyboard behavior.

Does not own:

- business rules, source verification, authorization, persistence, or domain API clients;
- application-specific navigation and workflow state;
- uploaded media lifecycle or a remote theme service;
- a backend registry or dynamic code execution for themes.

### `@riotworks/assets`

Owns original logo, symbol, wordmark, illustration, texture, pattern, and static asset metadata. Every new asset needs source, usage status, licensing, accessibility treatment, dimensions, and skin applicability.

### Applications

Applications select the correct skin by task and compose the route. They own data fetching, API calls, user permissions, route navigation, domain wording, and workflow state.

### ARSY/backend

The backend owns authorization and business truth. A skin cannot grant permissions, hide audit state, convert demo data into live data, or change evidence confidence.

## 9. Visual and component rules by skin

| Area | Observatory | Archive | Signal |
|---|---|---|---|
| Main composition | Instrument workspace | Reading/document layout | Poster/editorial story |
| Surface | Layered dark panels | Warm paper and ruled sections | Bold blocks and controlled texture |
| Typography | Grotesk + mono | Editorial hierarchy + readable body | Oversized display + concise body |
| Information density | Comfortable/compact | Comfortable/reading | Low-to-medium |
| Texture | Subtle orbital/topographic lines | Subtle grain/rules | Halftone/print/manga lines |
| Main accent | Signal Gold | Darkened editorial accent | Expressive brand accents |
| Best for | Operate and decide | Read and preserve | Enter and share |
| Avoid | Decorative HUD | Fake document authority | Dense operations and forms |

Shared primitive semantics do not change. A `Button` remains a button, a danger action remains danger, and a focus indicator remains visible in every skin. A skin may change visual treatment but not interaction meaning.

## 10. Accessibility, data truth, and motion

- Target WCAG 2.2 AA in every supported skin/mode pairing.
- Verify rendered contrast rather than trusting only source-level HSL values.
- Keep visible focus, keyboard access, correct semantics, readable labels, and touch targets consistent.
- Do not communicate status or confidence with color, texture, position, or motion alone.
- Respect `prefers-reduced-motion`; remove non-essential movement and provide static equivalents.
- Do not use auto-playing or flashing effects in Signal.
- Preserve source, date, author, confidence, and uncertainty in all skins.
- Label mock/demo/sample data truthfully, regardless of visual polish.
- Meaningful artwork needs alt text; decorative texture and SVG must be hidden from assistive technology.
- Verify narrow screens and 200% zoom.

## 11. Current implementation baseline

The following describes the checked-in baseline at the time of this blueprint; it is not a completion claim:

- `packages/ui` is a private workspace package consumed by Headquarter.
- The existing primitive set includes Button, Card composition, Badge, Separator, HalftoneSurface, and the `cn` utility.
- The Skin Engine feature branch adds a typed static registry for Observatory, Archive, and Signal; a deterministic resolver; and a server-compatible `SkinRoot`.
- The stylesheet maps the first supported pairs: Observatory/dark, Archive/light, and Signal/dark. The Archive root fallback and legacy selectors remain for compatibility.
- Source-level contract tests cover registry declarations, supported mode pairs, resolver fallback metadata, root attributes, and semantic token presence.
- Browser visual regression, rendered contrast review, screen-reader QA, and complete component-state verification remain open release gates.
- No global skin picker, persisted preference, React context, automatic Headquarter route mapping, or complete visual workbench is implemented yet.
- `apps/headquarter` owns its application shell and page compositions; the package does not yet own a complete shared app shell.
- The custom MOONWITNESS Signal WOFF2 is not approved for runtime use; use licensed font families and robust system fallbacks.

The implementation backlog remains in [packages/ui/todo.md](../packages/ui/todo.md). Backlog checkboxes must not be marked complete without code and verification evidence.

## 12. Implementation roadmap

The tasks below are intentionally small enough to be assigned to focused local AI agents. A task may update documentation, tests, or implementation, but it must not invent new brand decisions.

### Phase 0 — Lock the contract

- [ ] **S0-001** Read and reconcile docs/01, docs/10, docs/11, docs/12, docs/13, and packages/assets/BRAND.md.
- [ ] **S0-002** Record the three skin keys and their task boundaries in a typed contract proposal.
- [ ] **S0-003** Define the supported skin/appearance-mode matrix; mark unsupported pairings explicitly.
- [ ] **S0-004** Inventory all existing token names and map them to brand, semantic, skin, or component layers.
- [ ] **S0-005** Record legacy selector and Tailwind alias compatibility requirements.
- [ ] **S0-006** Confirm package and asset ownership boundaries; do not move app-shell or backend code into UI.

**Exit:** no contradictory brand hierarchy, token ownership, or skin naming remains.

### Phase 1 — Token foundation

- [ ] **S1-001** Define typed names for skin, mode, and density.
- [ ] **S1-002** Add semantic token definitions for all required foreground, surface, interaction, status, and evidence roles.
- [ ] **S1-003** Map Observatory tokens to the existing palette without changing semantic meanings.
- [ ] **S1-004** Map Archive tokens to warm paper and Deep Ink with readable reading surfaces.
- [ ] **S1-005** Define Signal tokens for expressive surfaces without changing semantic status colors.
- [ ] **S1-006** Define skin-level typography, spacing, shape, border, and elevation roles.
- [ ] **S1-007** Document supported mode pairings and fallback behavior.
- [ ] **S1-008** Add source-contract tests for token completeness and unsupported selectors.

**Exit:** tokens are complete, typed/documented, and semantic meaning is consistent.

### Phase 2 — Skin registry and runtime selection

- [ ] **S2-001** Define a static, typed SkinDefinition contract with key, label, description, supported modes, default mode, recommended density, and visual-purpose metadata.
- [ ] **S2-002** Add a static registry for Observatory, Archive, and Signal; no remote loading or dynamic imports.
- [ ] **S2-003** Add a small provider/root API or documented data-attribute integration contract.
- [ ] **S2-004** Apply skin/mode/density at the application or route root.
- [ ] **S2-005** Validate unknown skin and unsupported mode values with a safe fallback and development warning.
- [ ] **S2-006** Preserve existing `.dark`, `.theme-observatory`, and `.theme-archive` behavior during migration.
- [ ] **S2-007** Ensure server-rendered output and hydration use the same initial skin/mode.
- [ ] **S2-008** Do not add a global skin picker until app-level use cases and persistence are designed.

**Exit:** a consumer can choose a supported skin deterministically without hydration mismatch or hidden global state.

### Phase 3 — Shared primitives

- [ ] **S3-001** Audit Button, Card, Badge, Separator, and HalftoneSurface against all three skin profiles.
- [ ] **S3-002** Apply semantic tokens to primitives; remove new usage of legacy RIOTWORKS aliases.
- [ ] **S3-003** Define typography and focus treatments consistently across skins.
- [ ] **S3-004** Verify default, hover, focus, pressed, selected, disabled, loading, and invalid states as relevant.
- [ ] **S3-005** Verify keyboard behavior and accessible names for interactive primitives.
- [ ] **S3-006** Add interaction tests for critical controls.
- [ ] **S3-007** Keep existing public APIs compatible unless a separate reviewed migration is justified.

**Exit:** every existing primitive renders correctly in all skins it claims to support.

### Phase 4 — Experience compositions

- [ ] **S4-001** Build one Observatory specimen: operational workspace with source/status/evidence hierarchy.
- [ ] **S4-002** Build one Archive specimen: long-form record with citation and provenance treatment.
- [ ] **S4-003** Build one Signal specimen: public story/landing composition with a clear action.
- [ ] **S4-004** Ensure specimens use shared primitives and real semantic states.
- [ ] **S4-005** Ensure all sample/demo data is explicitly labelled.
- [ ] **S4-006** Document when an application should use each skin and when it should not.
- [ ] **S4-007** Keep domain behavior and API clients out of the shared UI package.

**Exit:** three distinct experiences demonstrate the same master identity without leaking application behavior into UI.

### Phase 5 — Workbench and quality gates

- [ ] **S5-001** Add a local skin workbench route/story collection for supported skins and modes.
- [ ] **S5-002** Add desktop, tablet, and mobile specimens for each skin.
- [ ] **S5-003** Add visual regression baselines for high-impact primitives and compositions.
- [ ] **S5-004** Run rendered contrast review for text, controls, focus, and semantic states.
- [ ] **S5-005** Run keyboard/focus and screen-reader review for critical components.
- [ ] **S5-006** Verify reduced-motion behavior and remove unnecessary animation.
- [ ] **S5-007** Verify 200% zoom/reflow and no unintended horizontal overflow.
- [ ] **S5-008** Record asset/font license status and visual approvals.
- [ ] **S5-009** Update package README, design-token documentation, and TODO with tested capabilities only.

**Exit:** quality evidence exists for each supported skin/mode pairing, not merely a screenshot of the default state.

### Phase 6 — Application adoption

- [ ] **S6-001** Map each current Headquarter route to Observatory, Archive, or Signal based on task.
- [ ] **S6-002** Keep operational, policy, security, and finance routes on an instrument/reading profile that protects legibility.
- [ ] **S6-003** Use Signal only for public/storytelling/onboarding contexts that benefit from expressive composition.
- [ ] **S6-004** Verify the Headquarter shell does not hardcode a competing RIOTWORKS master identity.
- [ ] **S6-005** Add a second consumer only when it exists and has a real route/use case.
- [ ] **S6-006** Remove legacy aliases only after every consumer has migrated and CI proves no usage remains.

**Exit:** each route has an explicit reason for its skin and the shared package remains the single UI foundation.

## 13. Definition of done

The Skin System is ready for general product use only when:

- [ ] The three skin definitions and non-goals are documented and consistent.
- [ ] One MOONWITNESS master mark and message hierarchy is used throughout.
- [ ] Skin, appearance mode, density, and accessibility preferences are independent.
- [ ] A typed static registry or equivalent deterministic contract exists.
- [ ] Components share semantics and interaction behavior across skins.
- [ ] Supported skin/mode pairings are browser-verified.
- [ ] Typography, asset sources, and licensing are documented.
- [ ] Responsive, keyboard, screen-reader, reduced-motion, and contrast checks pass.
- [ ] A consuming application demonstrates route-appropriate skin selection.
- [ ] No demo content is represented as verified/live data.
- [ ] Package tests, typecheck, lint, build/consumer smoke tests, and relevant CI pass.

## 14. Non-goals and deferred decisions

- Do not build 15, 30, or unlimited skins in the first release.
- Do not add a user-generated theme editor or remote skin marketplace.
- Do not automatically skin every route based only on a brand name.
- Do not merge ROCKSOUL art direction wholesale into MOONWITNESS.
- Do not resurrect generic RIOTWORKS Acid Lime styling as a default.
- Do not copy artwork or marks from historical MoonWitness/XIV/XV reference projects.
- Do not bundle the experimental Signal font until glyph coverage, rights, and owner approval are resolved.
- Do not move application-specific AppShell, navigation, permissions, or domain workflows into `@riotworks/ui`.

## 15. Change control

A new skin or material change requires:

1. A distinct user task that the current skins cannot serve well.
2. An owner, supported app/route list, and explicit non-goals.
3. A documented visual grammar and semantic token mapping.
4. Asset provenance and usage rights.
5. Responsive, accessibility, and evidence-truth acceptance criteria.
6. Review against the MOONWITNESS master identity.

Update docs/10, docs/11, and this blueprint together when a foundational visual decision changes. Update package and application documentation only after implementation matches the decision.
