# Corpus adapter contract

## Canonical ownership
Corpus owns canonical IDs, records, identity reconciliation, profiles, rights and source provenance. Divine receives them through injected read-only ports. It never generates canonical IDs, guesses identity from labels, chooses one ambiguous candidate, writes canonical records or duplicates profile schemas.

## Record envelope
The adapter preserves the Corpus `BaseRecord` envelope (`id`, `record_type`) and the complete record payload as opaque data. It validates the exact Corpus canonical-ID grammar and verifies that returned ID and record type match the request. Unknown record families fail explicitly; unavailable, restricted, metadata-only and not-found states remain distinct.

## Identity
Identity resolution is delegated to a `CorpusIdentityResolver`. Canonical IDs, source-local identifiers, external identifiers and aliases have separate structural fields. Source-local equality is scoped by source and optional namespace; external identifiers preserve authority scheme and exact value; aliases remain labels and are never normalized into canonical identity. Ambiguous resolution remains ambiguous.

## Profiles
A `CorpusProfileProvider` lists versioned profile descriptors and returns profile payloads. Divine sorts descriptors for deterministic presentation but does not transform or redefine profile data. Textual, source, bibliographic, manuscript, variants, lineage, lexicon, contextual, media and scholarly profile families remain Corpus-owned.

## Projection freshness
Projection keys include release ID, Corpus spec version, dataset version, content hash, record kind and canonical ID. Consumers can call `assertCorpusProjectionFresh` before reusing a projection. Any release/spec/dataset/hash change invalidates it.

## Loss and write semantics
The adapter is read-only and performs no lossy schema translation: the record/profile payload is passed through. Restricted or unsupported states are represented as explicit result variants. No write-back or reverse round-trip is offered because Divine is not the canonical owner. If a future adapter introduces transformation, it must provide a field-level fidelity/loss report and round-trip tests before activation.
