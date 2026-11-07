# Divine — SIDRATUL MUNTAHA

Evidence-centric epistemic and research infrastructure for MOONWITNESS.

**Status:** foundational implementation (Phase 0–2); not production-ready.

## Identity and ownership
The existing workspace uses `@riotworks/*`; Divine therefore uses `@riotworks/divine` until repository-wide naming governance changes. MoonWitness Corpus remains the canonical owner of Entity, Resource, Assertion, Evidence, Provenance, Assessment, canonical IDs, source artifacts, textual/manuscript/lexicon profiles, rights and provenance. Divine consumes Corpus read-only using its canonical `id` / `record_type` record identity and owns research context, addon composition, epistemic policies, reasoning and disposable projections.

Divine does not mint replacement Corpus IDs, duplicate canonical records, generate scripture, assert metaphysical verification, or import Headquarter internals. ORM, ARSY, ZILL and MIZAN remain adapter ports.

## Implemented
- Deterministic addon dependency resolution and lifecycle runtime.
- Typed errors and context contracts.
- Read-only Corpus adapter pinned to spec `0.1`.
- Lazy deterministic projection envelopes retaining canonical references.
- Registry and adapter tests.

## Checks
```bash
pnpm --filter @riotworks/divine type-check
pnpm --filter @riotworks/divine test
```
Node 22+ is required for native TypeScript tests. No database, ORM, ARSY, Python, RDF store, AI provider or network service is a runtime dependency. See docs/architecture and docs/CORPUS-MIGRATION.md.