# Divine — SIDRATUL MUNTAHA

Evidence-centric epistemic and research infrastructure for MOONWITNESS.

**Status:** foundational implementation (Phases 0–11 domain slices); not production-ready.

## Identity and ownership
The existing workspace uses `@riotworks/*`; Divine therefore uses `@riotworks/divine` until repository-wide naming governance changes. MoonWitness Corpus remains the canonical owner of Entity, Resource, Assertion, Evidence, Provenance, Assessment, canonical IDs, source artifacts, textual/manuscript/lexicon profiles, rights and provenance. Divine consumes Corpus read-only. ORM, ARSY, ZILL and MIZAN remain adapter ports.

Divine does not mint replacement Corpus IDs, duplicate canonical records, generate scripture, assert metaphysical verification, or import Headquarter internals.

## Implemented domain modules
- `./corpus`, `./ontology`, `./theology`, `./epistemology`: foundational Phases 0–5.
- `./evidence`, `./reasoning`, `./research`: Phase 6–8 evidence graph, defeasible reasoning, reproducible research and experimental proof-carrying certificates.
- `./preservation`: Phase 9 deterministic SHA-256 manifests, hash-chained decision history, integrity verification and explicit rights-action gate.
- `./ai`: Phase 10 provider-neutral extraction port, exact source-span validation, model/prompt provenance, candidate-only state, explicit human review and a non-writing promotion envelope.
- `./interop`: Phase 11 bounded exporters for PROV-O, SKOS, TEI P5, IIIF Presentation 3 and W3C Web Annotation, each with explicit fidelity/loss reports.

## Important limits
These are deterministic domain slices, not production integrations. AI extraction requires an externally supplied provider adapter; this package does not call an AI service. Promotion envelopes do not write to Corpus. Preservation hashes provide tamper evidence, not signatures or legal proof. TEI and IIIF outputs are deliberately minimal profiles; IIIF canvas dimensions are placeholders until supplied by a rights-aware media adapter. No database, graph store, vector store, Python runtime or network dependency is introduced.

## Checks
```bash
pnpm --filter @riotworks/divine type-check
pnpm --filter @riotworks/divine test
```
Node 22+ is required for native TypeScript tests. See `docs/evidence-reasoning-research.md` and `docs/preservation-ai-interop.md`.
