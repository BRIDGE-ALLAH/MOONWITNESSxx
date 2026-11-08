# Divine Architecture Decision Records

All decisions accepted 2026-11-08. Amendments require rationale, impact, migration path and review.

## ADR-0001 — Purpose and conceptual boundaries
Divine is a TypeScript-native modular evidence-centric research engine. SIDRATUL MUNTAHA and LAWH AL-MAHFUZ are metaphors for epistemic limits and preservation discipline only. Divine is not a scripture repository, second corpus, universal religious authority, truth-ranking engine, autonomous fatwa/doctrine engine or metaphysical oracle. Outputs distinguish textual observation, historical inference, community attribution, theological interpretation, machine inference and unknown/unobservable matters.

## ADR-0002 — Canonical Corpus ownership
MoonWitness Corpus owns canonical Entity, Resource, Assertion, Evidence, Provenance and Assessment records; canonical IDs; source artifacts; textual/manuscript/lexicon and other profiles; rights and provenance. Divine consumes these through a read-only adapter and creates disposable reproducible projections. Divine must not recreate Corpus records or mint replacement canonical IDs. Missing, restricted and unavailable records remain distinct. Every projection retains Corpus release, spec version, content hash, record type and canonical ID.

## ADR-0003 — Plural ontology and scoped claims
Ontology views coexist by tradition, community, school, period, method or project. Similar labels or semantic proximity never establish identity/equivalence. Crosswalks are versioned and carry scope, method, evidence and review. Revelation/theological statements are attributed scoped claims, never universalized or treated as metaphysical verification.

## ADR-0004 — Open-world epistemic semantics
Unknown is not false; not-recorded is not denied; unavailable is not nonexistent. Knowledge state, review state, evidence relation, method-bound assessment and source availability are separate axes. Divine must abstain with machine-readable reasons when evidence, scope or method is insufficient. No universal confidence/truth score.

## ADR-0005 — Reasoning and interoperability
Initial reasoning is deterministic and typed. Every derived result retains premise references, rule/method version and derivation trace. Contradictions are preserved; conclusions are defeasible and may be superseded. PROV-O, SKOS, SHACL, TEI, IIIF, CIDOC CRM, LRMoo and Web Annotation are interoperability targets only where semantics align. No RDF-first persistence, graph DB or Python runtime by default.

## ADR-0006 — Package, addon and adapter contracts
Existing root and packages use `@riotworks/*`; therefore the package is `@riotworks/divine`. The proposed `@moonwitness/divine` is deferred until repository-wide naming governance changes. Addons share one package and are dependency-ordered. Registry rejects duplicate IDs/services, missing/incompatible dependencies and cycles before lifecycle hooks. Multiple providers may expose a capability. Corpus/ORM/ARSY/ZILL/MIZAN are adapter ports, not foundational dependencies. No dependency may point from Divine to Headquarter.