# Phase 0 audit revalidation (2026-11-08)

This revalidation was performed against the current MOONWITNESS tree, the repository's repository-audit report and the live MoonWitness Corpus `main` source.

## Confirmed repository facts
- Workspace package scope is `@riotworks/*`; Divine therefore remains `@riotworks/divine`. A one-off `@moonwitness/*` namespace would violate current workspace consistency.
- The repository has a contract package and shared platform structure, but a production ORM implementation and production ARSY runtime were not found in the audited tree. Divine must define ports, not import nonexistent implementations.
- ZILL and MIZAN are authority boundaries/integration targets; Divine must not duplicate authorization policy or assessment authority.
- MoonWitness Corpus core defines `BaseRecord` with canonical `id` and `record_type`, and the record families Entity, Resource, Assertion, Evidence, Provenance and Assessment.
- Corpus identity boundaries distinguish canonical IDs, source-local identifiers and external identifiers. External identifier equality is authority scheme + exact value; source-local equality includes source context, namespace and exact local value.
- Corpus owns profiles and canonical text/manuscript/variant/lexicon/source/provenance data. Divine may read profile descriptors and payloads through adapters, but must not copy those schemas into a parallel canonical store.
- Corpus spec `v0.1` remains Draft/unstable. Compatibility is pinned explicitly; unsupported versions fail closed.

## Decisions revalidated
1. Divine core has no runtime dependency on ORM, ARSY, ZILL, MIZAN, a database, RDF store, Python or AI providers.
2. Adapters are capability-described ports. Missing capability produces an explicit error, not a fallback that silently changes semantics.
3. Canonical IDs are validated using the Corpus grammar and resolved only by Corpus identity contracts. Divine does not mint IDs, normalize aliases into identities or select among ambiguous candidates.
4. Source-local IDs, external identifiers and aliases remain separate values with their original authority/context.
5. Profile descriptors and profile payloads are delegated to Corpus providers; Divine does not recreate textual/manuscript/lexicon profiles.
6. Projections are pinned to Corpus release, spec version, dataset version and content hash. Stale projections must be rejected or recomputed.
7. Rights and availability remain separate from evidence quality and theological assessment.

## Remaining upstream dependency
The full Corpus subtree import is gated by dataset-by-dataset redistribution rights review because the source repository has no repository-wide license. This does not block the adapter contract work; it does block blindly copying third-party payloads into the public target.
