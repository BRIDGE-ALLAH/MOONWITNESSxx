# Divine — SIDRATUL MUNTAHA
## Evidence-Centric Epistemic Infrastructure
**Execution TODO and architecture work plan**

- **Repository:** BRIDGE-ALLAH/MOONWITNESS
- **Target path:** packages/divine/todo.md
- **Proposed package:** @moonwitness/divine
- **Codename:** SIDRATUL MUNTAHA
- **Architecture status:** proposed; implementation not yet started
- **Document status:** research-informed execution baseline
- **Last researched:** 2026-11-08

> This file is the executable task ledger for Divine. It is deliberately more detailed than a feature wishlist: every phase defines ownership, dependencies, deliverables, acceptance criteria, and explicit non-goals. A checked item means implementation and verification exist in the repository; documentation alone is not implementation.

---

# 0. Executive architecture decision

Divine is a TypeScript-native, modular, evidence-centric epistemic and research engine for religious, theological, textual, historical, and ontology-related workloads in the MOONWITNESS ecosystem.

Divine is NOT:
- a second canonical corpus;
- a replacement for MoonWitness Corpus;
- a universal religious truth database;
- a scripture generator;
- an automated fatwa, doctrine, salvation, or divine-judgment engine;
- a generic chatbot;
- an excuse to introduce a graph database, RDF store, vector database, or Python runtime before a demonstrated need;
- a second ORM or persistence framework.

Divine IS:
- a domain intelligence layer over canonical Corpus records;
- a registry for plural, scoped, versioned ontologies and domain profiles;
- an engine for claims, evidence relationships, provenance-aware reasoning, uncertainty, and epistemic boundaries;
- a reproducible research orchestration layer;
- a governed bridge between human scholarship, machine-assisted extraction, and downstream applications;
- an adapter-driven interoperability layer for established scholarly and semantic-web standards.

## 0.1 Core ownership boundary

| Concern | Authoritative owner | Divine responsibility |
|---|---|---|
| Canonical Entity, Resource, Assertion, Evidence, Provenance, Assessment | MoonWitness Corpus | Consume, query, reason over, and reference |
| Canonical IDs, labels, source identity, rights, textual structures, manuscripts, variants, lexicon, lineage, citations | MoonWitness Corpus profiles | Reuse and map; do not recreate |
| SQL persistence, model registry, field engine, transactions, recordsets | MOONWITNESS ORM when implemented | Integrate through supported ORM contracts |
| Runtime lifecycle, addon loading, service composition | ARSY when implemented | Register as a modular capability/provider |
| Policy, access and integrity controls | ZILL / platform security contracts | Enforce through explicit policy interfaces |
| Evidence assessment and accountability integration | MIZAN | Exchange method-bound assessments; do not duplicate its authority |
| Research domain logic, ontology governance, epistemic rules, reasoning and reproducibility | Divine | Own |
| UI, dashboards and operator workflows | Headquarter / downstream apps | Expose contracts and services; do not own UI |

Dependency direction must remain acyclic. Divine may define ports and adapters for Corpus, ORM, ARSY, ZILL and MIZAN. It must not import Headquarter or application internals.

**Repository reality gate:** the MOONWITNESS audit dated 2026-11-07 states that the custom ORM, SQL adapters, Base Platform addons and production ARSY core are not yet implemented. Do not pretend these are available. Divine planning and isolated pure-domain work may proceed, but persistence/runtime integration must wait for real contracts and working implementations.

## 0.2 Package and naming decision

- Package target: @moonwitness/divine.
- Repository path: packages/divine.
- Internal codename: SIDRATUL MUNTAHA.
- Preservation concept: LAWH AL-MAHFUZ.
- Product category: Sacred Knowledge & Epistemic Research Infrastructure.

The current MOONWITNESS root manifest still uses the riotworks package scope. Before publishing or declaring the package name final, reconcile workspace naming with the authoritative repository governance decision. Do not silently introduce a conflicting package scope or mass-rename existing packages as part of this task.

## 0.3 Conceptual inspiration boundary

Sidratul Muntaha and Lawh al-Mahfuz are conceptual inspirations for software architecture, not literal models of the unseen and not claims that software can access divine knowledge.

- SIDRAT: epistemic boundaries, limits of observation, access and inference.
- LAWH: preservation, integrity, traceability and non-erasure of historical records.
- WITNESS: evidence and source attribution.
- MIZAN: method-bound evaluation and accountability.
- HIZAB / HUDUD / BARZAKH: framework vocabulary for boundary concepts only; do not present the 1·6·3 mapping as an explicit Quranic numerical taxonomy.

The system must explicitly distinguish theological belief, community attribution, historical research, textual observation, editorial interpretation, machine inference and unknown/unobservable matters.

---

# 1. Non-negotiable invariants

These invariants apply to every addon, API, dataset adapter, reasoning rule, AI workflow, test fixture and user-facing result.

1. No synthetic scripture or fabricated quotation.
2. No generated text may be promoted to canonical source content.
3. No machine-generated claim becomes canonical without review, provenance and an authorized promotion process.
4. No unsourced assertion is represented as an established fact.
5. No global truth hierarchy is imposed across religions, traditions, schools or communities.
6. No tradition, denomination, school, role or doctrinal position is hard-coded as a closed universal enum.
7. No similarity score establishes identity, equivalence, authenticity or theological truth.
8. No global positive/negative, good/evil, true/false score is assigned to a tradition, scripture, community or person.
9. No contradiction is silently erased or automatically resolved.
10. Unknown is not false; not recorded is not denied; unavailable is not nonexistent.
11. Structural metadata is not silently converted into a world claim.
12. Source, evidence, provenance, assertion, interpretation and assessment remain distinct.
13. Assessment confidence is meaningful only within its declared method and scope.
14. Every derived output must retain input references, method/version and derivation provenance.
15. Rights, license, access and redistribution restrictions must be honored at ingestion, storage, display, export and AI processing boundaries.
16. Corrections must preserve historical decision and revision trace; immutable history does not mean immutable mistakes.
17. Every cross-tradition comparison must state its comparison frame and non-equivalence limitations.
18. The engine must be able to abstain and explain why evidence is insufficient or the question is out of scope.
19. AI systems are research assistants, not religious authorities.
20. No package, addon, adapter or feature is complete without tests, documentation and acceptance evidence.

---

# 2. Domain architecture and addon ownership

One source package, internally modular addons. Do not create a separate npm package for every folder or engine.

## 2.1 Proposed addon catalog

| Addon ID | Owns | Explicitly does not own |
|---|---|---|
| divine.core | Context, capability registry, contracts, errors, lifecycle hooks | ORM, storage, religion-specific models |
| divine.ontology | Ontology registry, concept schemes, typed relations, mappings, versions | Canonical Entity identity or generic Corpus records |
| divine.revelation | Tradition-scoped revelation-related classifications and claims | Metaphysical verification or canonical scripture storage |
| divine.theology | Tradition, school, doctrine and interpretation research profiles | Universal religious taxonomy or normative adjudication |
| divine.epistemology | Knowledge status, scope, uncertainty, boundaries, abstention | Universal truth score |
| divine.evidence | Claim/evidence graph, support/challenge relations, evidence traversal | Replacing Corpus Evidence records |
| divine.reasoning | Method-bound rules, derivation traces, defeasible reasoning | Unqualified theological verdicts |
| divine.research | Research sessions, queries, comparison plans, reproducible reports | Canonical source records |
| divine.preservation | Integrity verification, snapshots/references, decision history and export manifests | Replacing Corpus artifact/provenance storage |
| divine.ai | Candidate extraction, model contribution metadata, evaluation and review queues | Autonomous canonical writes |
| divine.interop | Standards mappings, import/export, validation bridges | A second canonical serialization |
| divine.adapters.corpus | Corpus contract adapter and compatibility checks | Copying Corpus database/schema |
| divine.adapters.orm | ORM persistence adapter once ORM exists | ORM implementation |
| divine.adapters.arsy | Runtime/service registration once ARSY contracts exist | Application bootstrap duplication |

Addons are independently declared and dependency-ordered. A profile can install a minimal subset. Optional capabilities must not be forced into every deployment.

## 2.2 Dependency rules

- divine.core has no dependency on other Divine addons.
- divine.ontology depends on divine.core.
- divine.evidence depends on divine.core and Corpus contracts.
- divine.epistemology depends on divine.core.
- divine.reasoning depends on divine.core, divine.evidence and divine.epistemology.
- divine.revelation and divine.theology depend on divine.core, divine.ontology and Corpus contracts.
- divine.research depends on divine.core and selected ontology/evidence/reasoning capabilities.
- divine.preservation depends on divine.core and Corpus provenance/source contracts.
- divine.ai depends on divine.core, divine.evidence, divine.research and governance contracts.
- divine.interop depends on divine.core and relevant profile adapters.
- ORM/ARSY/ZILL/MIZAN integrations are adapters, not foundational dependencies.

Registry must reject cycles, missing dependencies, duplicate IDs, incompatible versions, invalid capabilities and conflicting model contributions before runtime activation.

---

# 3. Research-informed architecture decisions

## 3.1 Evidence-centric Epistemic Knowledge Graph

Adopt an Evidence-Centric Epistemic Graph as a Divine projection and reasoning model, not as a replacement for the Corpus canonical model.

Every proposition/claim projection must be able to resolve:
- canonical target and predicate/object;
- assertion identity and assertion class;
- tradition/community/agent/period/place scope where applicable;
- evidence references and selectors;
- source and provenance lineage;
- assessor and method;
- epistemic state and review state;
- valid-time and recorded-time context where available;
- supporting, challenging, qualifying and superseding relationships;
- derivation chain for machine-generated or rule-derived outputs.

A graph edge without an explainable origin is not an acceptable research result.

## 3.2 Plural ontology, not a single universal taxonomy

Support multiple ontology packages and viewpoints:
- tradition-scoped ontology;
- school/community-scoped ontology;
- historical/critical ontology;
- comparative research ontology;
- project-specific scholarly ontology.

Crosswalk mappings must support:
- exact match;
- close match;
- broader than;
- narrower than;
- related but distinct;
- partial overlap;
- disputed mapping;
- no defensible mapping.

Mapping records need source ontology/version, target ontology/version, mapping method, scope, evidence, reviewer and status. Similar labels, transliterations, shared functions or narrative motifs never establish equivalence by themselves.

## 3.3 Open-world and explicit epistemic states

Default to open-world semantics for research claims. Missing records do not prove nonexistence or denial.

Do not compress all epistemic dimensions into one enum. Keep at least these axes distinct:

- knowledge state: known-within-scope, unknown, not-recorded, not-applicable, unobservable, unverifiable, out-of-scope;
- claim/review state: candidate, draft, reviewed, disputed, superseded, withdrawn;
- evidence relation: supports, challenges, qualifies, contextualizes, mentions, quotes;
- assessment result: method-defined vocabulary;
- source availability: available, restricted, unavailable, metadata-only.

A result may be simultaneously disputed, supported by some evidence, challenged by other evidence and method-limited.

## 3.4 Defeasible, provenance-aware reasoning

Reasoning must be explainable and revisable:
- every derived conclusion links to premises, rules, method version and source data;
- new evidence may defeat a previous inference;
- competing conclusions can coexist under different scopes or methods;
- contradiction does not cause classical explosion;
- no inference crosses tradition/community scope without an explicit rule;
- no rule turns semantic similarity into identity;
- no inference silently changes an assertion into canonical truth.

Start with deterministic, typed rules and explicit graph traversal. Add probabilistic or ML-assisted inference only behind separately versioned methods and evaluations.

## 3.5 Temporal and historical reasoning

Distinguish:
- time described by a source or claim;
- time an event is said to have occurred;
- time a source/artifact was produced;
- time a record entered the corpus;
- time a curator reviewed or changed a record;
- time an assessment was valid under its method.

Use Corpus temporal profile and canonical period references. Divine may add bitemporal research projections and temporal query services, but must not fork Corpus date/chronology contracts. Preserve uncertainty in dates and calendar conversions; do not coerce approximate chronology into false precision.

## 3.6 Witness-family and leakage-aware evaluation

For textual and report comparison, distinguish:
- exact textual match;
- near-parallel witness;
- related transmission;
- semantic support;
- contextual mention;
- non-relevant result;
- unresolved relationship.

Family/group relationships must be considered when creating train/validation/test splits. Closely related witnesses, variants or derived passages must not leak across evaluation partitions in ways that inflate retrieval or extraction performance.

Do not treat text similarity as proof of shared origin, authenticity or doctrinal equivalence.

## 3.7 Human–AI contribution ledger

For every machine-assisted candidate or derived output, preserve:
- model/provider and model version where disclosure is permitted;
- prompt/template or task specification version;
- input corpus release/hash and exact record references;
- extraction/normalization pipeline version;
- generation timestamp;
- confidence or uncertainty only where calibrated and method-defined;
- reviewer identity/role and review decision;
- edits, rejection reasons and supersession links;
- rights and policy checks applied.

Human review must not be falsely represented as model verification. Model output must not be disguised as human scholarship.

## 3.8 Ontology change intelligence

Before ontology changes are applied:
- compute affected concepts, relations, mappings and dependent rules;
- detect identifier retirement and replacement;
- identify broken mappings and query behavior changes;
- validate all dependent datasets and profile constraints;
- produce a migration plan and rollback plan;
- require authorized review for breaking or semantically consequential changes.

Keep old ontology versions addressable. A new version must not rewrite the meaning of a historical research result.

---

# 4. Research and standards reference register

The following works inform the design. They are research inputs, not automatic proof that a particular implementation is correct. Recheck versions, licenses and technical details before adopting dependencies.

## 4.1 GitHub projects and engineering patterns

- Graphify — https://github.com/Graphify-Labs/graphify
  - Inspiration: deterministic graph construction from repositories/documents, explainable edges and graph traversal.
  - Divine application: source-linked graph projections and explainable relationship traversal.
- NVIDIA Auto Ontology — https://github.com/NVIDIA/auto-ontology
  - Inspiration: ontology discovery from metadata and semantic graph exposure to agents.
  - Divine application: suggested ontology candidates only; never auto-promote without governance.
- Semantica — https://github.com/semantica-agi/semantica
  - Inspiration: ontology governance, deterministic reasoning and decision provenance.
  - Divine application: versioned ontology lifecycle and traceable reasoning.
- LightRAG — https://github.com/HKUDS/LightRAG
  - Inspiration: graph-aware retrieval and contextual discovery.
  - Divine application: optional retrieval adapter; retrieval is not evidence.
- Open Ontologies — https://github.com/fabio-rovai/open-ontologies
  - Inspiration: ontology change review, rollback and impact analysis.
  - Divine application: change plans, blast-radius reports and reviewer-verifiable migrations.
- RDFLib pySHACL — https://github.com/RDFLib/pySHACL
  - Inspiration: SHACL graph validation interoperability.
  - Divine application: optional validation bridge, not a mandatory Python runtime dependency.
- LinkML — https://github.com/linkml/linkml
  - Inspiration: linked-data modeling and schema interoperability.
  - Divine application: evaluate export/mapping only if it does not create a competing canonical model.

Do not use GitHub star counts as a technical quality metric. Review license, maintenance, security, architecture, dependency footprint, benchmarks and actual fit before adopting code or packages.

## 4.2 Research papers

- Kejriwal, 2026, Semantics for Science: Toward a Massive Scale Evidence-Centric Scientific Knowledge Graph.
  https://www.isi.edu/results/publications/82525/semantics-for-science-toward-a-massive-scale-evidence-centric-scientific-knowledge-graph/
  Design impact: claims, evidence traces, uncertainty, scope, temporal evolution, contradictions and provenance as first-class research concerns.
- Chhetri et al., WWW Companion 2025, Bridging the Scientific Knowledge Gap and Reproducibility: A Survey of Provenance, Assertion and Evidence Ontologies.
  https://doi.org/10.1145/3701716.3715483
  Design impact: reuse and map established assertion/evidence/provenance vocabularies rather than inventing isolated equivalents.
- Kamran, Butt and Basharat, 2026, Semantic Enrichment of Hadith Corpus—Knowledge Graph Generation From Islamic Text.
  https://journals.sagepub.com/doi/10.1177/22104968261431425
  Design impact: Arabic language complexity, domain-aware extraction and human-reviewed semantic enrichment.
- Mosa, 2026, Semantic takhrij for cross-collection Hadith retrieval: a leakage-controlled evaluation framework.
  https://doi.org/10.1093/llc/fqag097
  Design impact: graded retrieval relevance, canonical identity, provenance-aware outputs and family-aware dataset splitting.
- Ahmad and Ghafar, 2026, Who speaks when machines read scripture: boundary-making and interpretive authority in AI-mediated religious knowledge.
  https://link.springer.com/article/10.1007/s43681-026-01254-5
  Design impact: disclosure of textual provenance, human/machine roles, validation pathways and context-specific ethical oversight.
- Dammu et al., EMNLP Findings 2024, ClaimVer: Explainable Claim-Level Verification and Evidence Attribution of Text Through Knowledge Graphs.
  https://aclanthology.org/2024.findings-emnlp.795/
  Design impact: claim-level decomposition, evidence display and attribution rather than document-wide truth labels.
- Lazzerini and Di Franco, 2026, Creating a digital critical edition of a classical text with XML/TEI.
  https://doi.org/10.60923/issn.2532-8816/23486
  Design impact: textual apparatus, witness hierarchy and stand-off annotation remain in Corpus/TEI adapters, not a duplicate Divine text store.
- ALMA, Automated alignment of ancient texts using linguistic and semantic analysis.
  https://www.cambridge.org/core/journals/computational-humanities-research/article/alma-automated-alignment-of-ancient-texts-using-linguistic-and-semantic-analysis/4267FDB026BD3433D4BAEC2ED254778E
  Design impact: evaluate alignment methods on actual language-specific benchmark sets; do not treat a published score as a universal guarantee.
- Computational approaches and the epistemology of scholarly editing, 2024.
  https://link.springer.com/article/10.1007/s42803-024-00088-z
  Design impact: retain the interpretation process and material-trace uncertainty; avoid lossy transformations that conceal editorial assumptions.
- Knowledge graphs generation from cultural heritage texts: combining LLMs and ontological engineering for scholarly debates, 2026.
  https://doi.org/10.1108/JD-07-2025-0203
  Design impact: iterative annotation schema, ontology engineering, extraction pipeline and evaluation with scholarly review.

## 4.3 Standards and interoperability targets

- W3C PROV-O / PROV-DM: https://www.w3.org/TR/prov-o/
- W3C SHACL: https://www.w3.org/TR/shacl/
- W3C RDF / RDF 1.1: https://www.w3.org/TR/rdf11-concepts/
- W3C SKOS: https://www.w3.org/TR/skos-reference/
- W3C Web Annotation: https://www.w3.org/TR/annotation-model/
- CIDOC CRM / ISO 21127: https://cidoc-crm.org/
- LRMoo: https://cidoc-crm.org/lrmoo
- TEI P5: https://www.tei-c.org/release/doc/tei-p5-doc/en/html/
- IIIF Presentation API 3: https://iiif.io/api/presentation/3.0/
- BCP 47 language tags: https://www.rfc-editor.org/rfc/bcp/bcp47.txt
- ISO 15924 script codes: https://www.unicode.org/iso15924/

Adoption policy:
- map to standards where semantics align;
- document any lossy mapping;
- preserve source vocabulary and original identifiers;
- never claim full standards compliance from a partial adapter;
- keep standards export deterministic and versioned;
- do not require an RDF triple store for the TypeScript core.

---

# 5. Detailed implementation roadmap

## PHASE 0 — Repository alignment and architecture lock

**Priority:** P0 / blocking before runtime integration.

### Tasks
- [x] DIV-P0-001 Verify repository branch, HEAD, package manager, workspace configuration and current package inventory.
- [x] DIV-P0-002 Confirm packages/divine does not already exist before scaffolding.
- [ ] DIV-P0-003 Re-read the authoritative MOONWITNESS repository audit and current execution plan.
- [x] DIV-P0-004 Reconcile proposed @moonwitness/divine scope with current root riotworks scope and repository naming governance.
- [x] DIV-P0-005 Create ADR: Divine purpose, non-goals and conceptual inspiration boundary.
- [x] DIV-P0-006 Create ADR: Divine versus MoonWitness Corpus ownership.
- [x] DIV-P0-007 Create ADR: Corpus canonical data versus Divine derived projections.
- [x] DIV-P0-008 Create ADR: plural ontology and scoped theological claims.
- [x] DIV-P0-009 Create ADR: epistemic states, open-world semantics and abstention.
- [x] DIV-P0-010 Create ADR: reasoning trace, defeasible rules and contradiction preservation.
- [x] DIV-P0-011 Create ADR: standards interoperability without RDF-first persistence.
- [x] DIV-P0-012 Define addon catalog, dependency DAG and capability profiles.
- [ ] DIV-P0-013 Define adapter ports for Corpus, ORM, ARSY, ZILL and MIZAN without importing unavailable implementations.
- [x] DIV-P0-014 Define package export policy and public/internal module boundaries.
- [ ] DIV-P0-015 Define licensing, rights and sensitive-content governance requirements.
- [x] DIV-P0-016 Record a research register with paper/project links, adoption rationale and review date.

### Deliverables
- Architecture decision records.
- Domain ownership matrix.
- Addon dependency graph.
- Adapter interface outline.
- Explicit implementation readiness report.

### Acceptance
- No duplicated Corpus responsibility remains in Divine scope.
- No dependency points from Divine into Headquarter.
- No assumption that ORM or ARSY is implemented.
- Every proposed addon has a single ownership statement and non-goal.
- Naming decision is consistent with repository governance.
- The architecture can be reviewed without interpreting conceptual metaphors as literal metaphysical claims.

---

## PHASE 1 — Divine Core and addon registry

**Priority:** P0 / pure-domain foundation.

### Tasks
- [x] DIV-P1-001 Scaffold package only after Phase 0 approval and workspace naming resolution.
- [x] DIV-P1-002 Implement strict TypeScript configuration consistent with repository conventions.
- [x] DIV-P1-003 Define DivineContext: actor, capabilities, locale, research scope, trace ID, method registry and adapter handles.
- [x] DIV-P1-004 Define typed domain errors and stable error codes.
- [x] DIV-P1-005 Define addon manifest: id, version, dependencies, capabilities, models, services, hooks and compatibility range.
- [x] DIV-P1-006 Implement deterministic addon dependency resolution.
- [x] DIV-P1-007 Reject dependency cycles, duplicate IDs, missing dependencies and incompatible versions.
- [x] DIV-P1-008 Implement explicit capability registration and discovery.
- [x] DIV-P1-009 Define service registration without implicit public API exposure.
- [x] DIV-P1-010 Define lifecycle hooks with deterministic ordering and failure semantics.
- [ ] DIV-P1-011 Define adapter interfaces and capability checks.
- [x] DIV-P1-012 Define versioned public exports; keep internal modules private.
- [x] DIV-P1-013 Add tests for empty registry, single addon, dependency ordering, conflict, cycle and failed initialization.
- [ ] DIV-P1-014 Add tests proving importing Divine core does not require ORM, database, Python, RDF store, AI provider or network.
- [x] DIV-P1-015 Add package build, typecheck, lint and test scripts consistent with root tooling.
- [ ] DIV-P1-016 Add minimal examples demonstrating addon composition without persistence.

### Acceptance
- Core can initialize in a clean Node/TypeScript test environment.
- Registry ordering is deterministic across repeated runs.
- Invalid addon graphs fail before partial activation.
- Core remains usable without external services.
- No placeholder package is described as production-ready.

---

## PHASE 2 — Corpus adapter and canonical boundary

**Priority:** P0 / blocking for real research data.

### Tasks
- [x] DIV-P2-001 Read the current Corpus specification, compatibility policy, core package exports and all relevant profiles before implementing the adapter.
- [x] DIV-P2-002 Pin a specific Corpus spec/release compatibility range; do not target an unstable moving branch silently.
- [x] DIV-P2-003 Define CorpusReader and CorpusRelease interfaces.
- [ ] DIV-P2-004 Resolve canonical IDs only through Corpus identity contracts.
- [x] DIV-P2-005 Consume Entity, Resource, Assertion, Evidence, Provenance and Assessment records without redefining them.
- [ ] DIV-P2-006 Reuse textual, source, bibliographic, manuscript, variants, lineage, lexicon, contextual, media and scholarly profiles where applicable.
- [ ] DIV-P2-007 Preserve exact source-local IDs, external identifiers and aliases as separate identity forms.
- [x] DIV-P2-008 Preserve assertion scope and method-bound assessment semantics.
- [x] DIV-P2-009 Preserve source availability, rights and licensing restrictions in query results.
- [x] DIV-P2-010 Define missing, restricted, unavailable and partial response states.
- [x] DIV-P2-011 Define lazy graph projection from Corpus records; no duplicate authoritative copy.
- [x] DIV-P2-012 Define deterministic projection keys and source release/hash references.
- [ ] DIV-P2-013 Detect stale projections when Corpus release or contract version changes.
- [ ] DIV-P2-014 Add compatibility tests against real synthetic fixtures from Corpus.
- [ ] DIV-P2-015 Add round-trip tests for supported mappings and explicit loss reports for unsupported fields.
- [x] DIV-P2-016 Document adapter behavior when Corpus is absent or incompatible.

### Acceptance
- Every projected record resolves to a canonical Corpus record.
- No Divine-generated canonical IDs are substituted for Corpus IDs.
- Projection can be rebuilt from a pinned Corpus release.
- Restricted source content is never exposed by bypassing rights metadata.
- Unsupported semantics fail visibly rather than being silently discarded.

---

## PHASE 3 — Ontology Intelligence

**Priority:** P1.

### Tasks
- [x] DIV-P3-001 Define Ontology, OntologyVersion and OntologyProfile contracts.
- [x] DIV-P3-002 Define ConceptScheme and ConceptReference without duplicating Corpus lexicon records.
- [x] DIV-P3-003 Define typed relation registry with explicit domain/range and semantic notes.
- [x] DIV-P3-004 Support broader, narrower, related, part-of, instance-of and domain-specific relations without forcing all into universal truth.
- [x] DIV-P3-005 Define relation semantics and whether a relation is structural, asserted, derived or mapping-only.
- [x] DIV-P3-006 Define ontology namespace and identifier policy; distinguish ontology IDs from Corpus canonical IDs.
- [x] DIV-P3-007 Support multiple ontology versions side by side.
- [x] DIV-P3-008 Support scoped ontology profiles by tradition, community, school, period, research method or project.
- [x] DIV-P3-009 Define mapping relation vocabulary: exact, close, broader, narrower, partial, related, disputed, none.
- [x] DIV-P3-010 Require evidence/method/reviewer for promoted cross-ontology mappings.
- [ ] DIV-P3-011 Implement candidate generation interface without automatic identity/equivalence promotion.
- [x] DIV-P3-012 Implement ontology validation and unresolved-reference reports.
- [x] DIV-P3-013 Implement ontology diff and impact analysis.
- [ ] DIV-P3-014 Implement deprecation/replacement and migration plans.
- [ ] DIV-P3-015 Add SKOS export/import adapter with mapping fidelity report.
- [x] DIV-P3-016 Add tests for multilingual concepts, ambiguous labels, conflicting mappings and deprecated concepts.

### Acceptance
- Two conflicting ontology views can coexist without forced merge.
- Similar labels never auto-create sameAs/equivalent relations.
- A mapping is reproducible and method-attributed.
- Historical ontology versions remain addressable.
- Changes produce an impact report before activation.

---

## PHASE 4 — Revelation and Theology research profiles

**Priority:** P1 / requires ontology and Corpus adapter.

### Tasks
- [x] DIV-P4-001 Define RevelationResearchProfile as a scoped research profile, not a metaphysical truth oracle.
- [x] DIV-P4-002 Separate revelation-related theological claims from textual witness identity and historical transmission.
- [x] DIV-P4-003 Represent claims that a community/tradition regards a work or passage as revelation through Corpus Assertion plus scope/evidence/provenance.
- [x] DIV-P4-004 Distinguish theological attribution, canonical recognition, textual attestation, historical-critical assessment and editorial status.
- [x] DIV-P4-005 Define tradition and school references as open, versioned domain data, not closed universal enums.
- [x] DIV-P4-006 Define doctrine/position/interpretation profiles with source, scope, period and method.
- [x] DIV-P4-007 Preserve intra-tradition disagreement and historical change.
- [x] DIV-P4-008 Define comparison frames that state which dimensions are being compared.
- [x] DIV-P4-009 Define explicit non-equivalence and incomparable states.
- [x] DIV-P4-010 Prevent the engine from generating normative religious verdicts or universal authority rankings.
- [x] DIV-P4-011 Define review workflows for domain experts and authorized communities without claiming one reviewer speaks for all adherents.
- [x] DIV-P4-012 Add fixtures for multiple traditions and competing interpretations without fabricating sacred source text.

### Acceptance
- A claim about revelation is attributable to its source/scope and not silently converted to universal fact.
- Canonical textual identity remains in Corpus.
- Historical-critical and confessional interpretations can coexist.
- Comparative output discloses method and limits.
- No universal religious taxonomy is hard-coded.

---

## PHASE 5 — SIDRAT Epistemology and boundary engine

**Priority:** P1 / central differentiator.

### Tasks
- [x] DIV-P5-001 Define epistemic dimensions separately from Corpus assertion and assessment fields.
- [x] DIV-P5-002 Define knowledge states: known-within-scope, unknown, not-recorded, not-applicable, unobservable, unverifiable and out-of-scope.
- [x] DIV-P5-003 Define evidence sufficiency as method-specific, not universal.
- [x] DIV-P5-004 Define claim scope validation and explicit scope propagation rules.
- [x] DIV-P5-005 Prevent cross-tradition inference unless a declared comparison/mapping rule permits it.
- [x] DIV-P5-006 Define uncertainty representation without one universal confidence score.
- [x] DIV-P5-007 Distinguish aleatoric, epistemic, source, temporal and interpretation uncertainty where useful and method-supported.
- [x] DIV-P5-008 Define abstention outcomes and machine-readable reasons.
- [x] DIV-P5-009 Define boundary policies for unobservable/metaphysical questions.
- [x] DIV-P5-010 Define missing-data semantics and ensure absence never becomes negation.
- [x] DIV-P5-011 Define user-facing explanation contract: known evidence, missing evidence, scope, method and limitations.
- [ ] DIV-P5-012 Add property-based tests for unknown/not-recorded/not-applicable/false distinctions.
- [x] DIV-P5-013 Add tests proving an unsupported query returns abstention rather than invented content.
- [x] DIV-P5-014 Add documentation on the Sidrat conceptual inspiration and its non-literal software interpretation.

### Acceptance
- Engine can say “not established by the available evidence” without converting it to false.
- Out-of-scope and unobservable queries are not answered with fabricated certainty.
- Every epistemic label is explainable through a declared policy/method.
- No single numeric score is treated as universal truth.

---

## PHASE 6 — Evidence Graph and witness intelligence

**Priority:** P1.

### Tasks
- [ ] DIV-P6-001 Define graph projection contracts over Corpus assertions, evidence, provenance and assessments.
- [ ] DIV-P6-002 Model support, challenge, qualification, contextualization, quotation and mention as distinct evidence relations.
- [ ] DIV-P6-003 Preserve precise selectors and passage/fragment references.
- [ ] DIV-P6-004 Define evidence path traversal with source and provenance at every hop.
- [ ] DIV-P6-005 Define source independence as an explicit method assessment, never inferred from different URLs alone.
- [ ] DIV-P6-006 Define witness family/group references using Corpus lineage and textual variant information.
- [ ] DIV-P6-007 Define exact match, near-parallel, related transmission, semantic support, context mention and non-relevant retrieval classes.
- [ ] DIV-P6-008 Keep lexical similarity separate from historical transmission and identity.
- [ ] DIV-P6-009 Add contradiction and disagreement views that preserve both sides.
- [ ] DIV-P6-010 Define graph projection invalidation and rebuild from pinned Corpus release.
- [ ] DIV-P6-011 Add deterministic graph serialization for reproducible tests.
- [ ] DIV-P6-012 Add test fixtures with deliberately conflicting evidence and multiple witness families.

### Acceptance
- Every graph edge resolves to a source assertion, structural relation or documented derived rule.
- Evidence paths are inspectable and reproducible.
- Conflicting witnesses are retained.
- Similarity alone never promotes a witness relation or identity.
- Projection rebuild produces stable output for identical inputs and method versions.

---

## PHASE 7 — MIZAN-compatible reasoning and assessment

**Priority:** P1/P2.

### Tasks
- [ ] DIV-P7-001 Define ReasoningMethod and RuleSet contracts with semantic versioning.
- [ ] DIV-P7-002 Define typed premises, conclusions, exceptions and rule applicability scope.
- [ ] DIV-P7-003 Implement deterministic graph traversal and rule execution before probabilistic inference.
- [ ] DIV-P7-004 Preserve premise references, rule ID/version and derivation trace for every conclusion.
- [ ] DIV-P7-005 Implement defeasible conclusions that can be superseded by new evidence.
- [ ] DIV-P7-006 Preserve multiple valid conclusions under distinct methods/scopes.
- [ ] DIV-P7-007 Prevent contradiction explosion and silent conflict resolution.
- [ ] DIV-P7-008 Keep confidence/calibration inside the declared assessment method.
- [ ] DIV-P7-009 Define source-quality and evidence-quality assessment interfaces without universal source rankings.
- [ ] DIV-P7-010 Define MIZAN adapter contract; MIZAN remains a separate accountability/evaluation authority.
- [ ] DIV-P7-011 Add counterexample tests, contradictory premises and scope-boundary tests.
- [ ] DIV-P7-012 Add explanation renderer contract for “why this conclusion” and “what could defeat it”.

### Acceptance
- Same inputs, rules and versions produce deterministic conclusions.
- Every conclusion has a complete derivation trace.
- New evidence can invalidate or supersede a derived conclusion without erasing its history.
- Different methods can legitimately disagree.
- No reasoning result becomes a theological verdict by default.

---

## PHASE 8 — Research Intelligence and reproducibility

**Priority:** P2.

### Tasks
- [ ] DIV-P8-001 Define ResearchSession and ResearchPlan as operational records, separate from canonical Corpus data.
- [ ] DIV-P8-002 Define query scope, selected Corpus release, ontology versions and method versions.
- [ ] DIV-P8-003 Implement evidence-first retrieval interface.
- [ ] DIV-P8-004 Add exact ID/citation lookup before fuzzy/semantic retrieval.
- [ ] DIV-P8-005 Add hybrid lexical/structural/semantic retrieval as separate ranked channels.
- [ ] DIV-P8-006 Require semantic retrieval results to show source evidence and similarity method.
- [ ] DIV-P8-007 Add cross-collection search with witness-family-aware result grouping.
- [ ] DIV-P8-008 Add comparative research plans with explicit frame and non-equivalence warnings.
- [ ] DIV-P8-009 Define reproducible report manifest: input release/hash, query, methods, ontology versions, software version and timestamp.
- [ ] DIV-P8-010 Add export to Markdown/JSON and later scholarly formats where useful.
- [ ] DIV-P8-011 Define benchmark datasets using rights-cleared or synthetic fixtures.
- [ ] DIV-P8-012 Define leakage-controlled train/validation/test split strategy by source/witness family.
- [ ] DIV-P8-013 Measure retrieval precision/recall, evidence attribution, citation correctness, abstention quality and human review agreement.
- [ ] DIV-P8-014 Report disagreement and coverage; do not hide unresolved cases behind aggregate scores.

### Acceptance
- A report can be regenerated from its manifest.
- Search result ranking is distinguishable from evidential support.
- Citations resolve to exact source/passage/evidence.
- Evaluation splits prevent obvious witness-family leakage.
- Benchmarks disclose sample size, coverage and limitations.

---

## PHASE 9 — LAWH Preservation, provenance and governance

**Priority:** P2.

### Tasks
- [ ] DIV-P9-001 Reuse Corpus source/artifact/provenance contracts and avoid duplicate artifact storage.
- [ ] DIV-P9-002 Define preservation manifest for each research release and derived projection.
- [ ] DIV-P9-003 Record hashes, algorithm identifiers, source release and derivation method.
- [ ] DIV-P9-004 Define append-only research decision history for promotion, rejection, correction and supersession.
- [ ] DIV-P9-005 Ensure correction creates a new trace and does not erase the prior decision.
- [ ] DIV-P9-006 Define rights checks at ingestion, query, display, export and AI processing.
- [ ] DIV-P9-007 Define restricted-content behavior and metadata-only fallback.
- [ ] DIV-P9-008 Define human reviewer role, review method and review timestamp attribution.
- [ ] DIV-P9-009 Define retention and deletion rules compatible with legal obligations and source rights.
- [ ] DIV-P9-010 Define tamper-evidence verification and integrity report.
- [ ] DIV-P9-011 Define signed release manifests only if key management and signing infrastructure exist.
- [ ] DIV-P9-012 Integrate ZILL policy and platform audit interfaces when available.

### Acceptance
- Every released derived artifact can identify its exact inputs and method.
- Integrity failure is visible and blocks promotion.
- Rights restrictions cannot be bypassed through export or AI adapters.
- Historical decisions remain auditable while lawful deletion/retention requirements are respected.
- “Immutable” is never misrepresented as “infallible”.

---

## PHASE 10 — AI Research Assistant and extraction governance

**Priority:** P2/P3; only after deterministic foundations.

### Tasks
- [ ] DIV-P10-001 Define AI provider-neutral interfaces; no provider lock-in in core.
- [ ] DIV-P10-002 Define candidate extraction tasks for entities, claims, evidence selectors, relations and mappings.
- [ ] DIV-P10-003 Require exact source spans or selectors for extracted claims whenever the source supports them.
- [ ] DIV-P10-004 Attach model/provider/version, task prompt version, input release and pipeline provenance.
- [ ] DIV-P10-005 Store AI outputs in candidate/review queues, not canonical Corpus records.
- [ ] DIV-P10-006 Require human review and explicit promotion authority.
- [ ] DIV-P10-007 Record edits, rejection reasons and reviewer decisions.
- [ ] DIV-P10-008 Prevent AI-generated scripture, quotation or source text from being treated as source content.
- [ ] DIV-P10-009 Define hallucination, citation integrity and unsupported-answer evaluations.
- [ ] DIV-P10-010 Define abstention and safe response for metaphysical/unobservable questions.
- [ ] DIV-P10-011 Define language-specific evaluation, especially Arabic and other source languages.
- [ ] DIV-P10-012 Evaluate model performance separately by task, language, tradition, source type and scope.
- [ ] DIV-P10-013 Add prompt injection and untrusted-source tests.
- [ ] DIV-P10-014 Add disclosure contract distinguishing human-authored, machine-suggested, machine-derived and human-reviewed material.

### Acceptance
- AI cannot write directly into canonical Corpus storage.
- Every promoted result has provenance and authorized review.
- Exact quotations are verified against source artifacts.
- Model confidence is not presented as truth.
- Unsupported questions trigger abstention.
- Evaluation includes adversarial and language-specific cases.

---

## PHASE 11 — Standards interoperability

**Priority:** P2/P3.

### Tasks
- [ ] DIV-P11-001 Implement PROV-O mapping for supported agents, activities, entities and derivations.
- [ ] DIV-P11-002 Implement SKOS mapping for concept schemes and mappings.
- [ ] DIV-P11-003 Evaluate SHACL validation bridge for exported RDF graphs.
- [ ] DIV-P11-004 Map textual/manuscript structures to TEI where semantics align.
- [ ] DIV-P11-005 Map digital manuscript/media references to IIIF Presentation API 3.
- [ ] DIV-P11-006 Evaluate CIDOC CRM mapping for cultural heritage and historical event contexts.
- [ ] DIV-P11-007 Evaluate LRMoo mapping for bibliographic/work/expression semantics.
- [ ] DIV-P11-008 Map selectors to W3C Web Annotation where supported.
- [ ] DIV-P11-009 Preserve original IDs, namespaces, language/script and source metadata.
- [ ] DIV-P11-010 Produce machine-readable loss report for every export/import.
- [ ] DIV-P11-011 Add round-trip tests for supported subsets.
- [ ] DIV-P11-012 Document partial compliance and unsupported constructs.

### Acceptance
- Standards exports are deterministic and versioned.
- Round-trip preserves supported semantics.
- Lossy mappings are explicitly reported.
- No external standard becomes a second canonical source of truth.
- No mandatory runtime RDF store is introduced without a separate ADR and benchmark.

---

## PHASE 12 — Runtime integration and production readiness

**Priority:** blocked until platform contracts exist.

### Tasks
- [ ] DIV-P12-001 Verify MOONWITNESS ORM implementation, package exports and integration tests before creating persistence adapter.
- [ ] DIV-P12-002 Verify ARSY runtime lifecycle and addon/service contracts before registering Divine.
- [ ] DIV-P12-003 Implement ORM adapter only against published/stable model and transaction APIs.
- [ ] DIV-P12-004 Implement ARSY service provider and health/readiness checks.
- [ ] DIV-P12-005 Integrate ZILL authorization, scope enforcement and audit contracts.
- [ ] DIV-P12-006 Integrate MIZAN assessment exchange without duplicating its domain ownership.
- [ ] DIV-P12-007 Define background work and queue contracts through the platform's canonical worker architecture.
- [ ] DIV-P12-008 Add tracing, metrics and structured logs with sensitive-data redaction.
- [ ] DIV-P12-009 Add resource limits, pagination, query budgets and graph traversal depth limits.
- [ ] DIV-P12-010 Add cache invalidation keyed by Corpus release, ontology version and method version.
- [ ] DIV-P12-011 Add backup/restore and reproducible projection rebuild runbooks.
- [ ] DIV-P12-012 Add security, dependency, license and supply-chain checks.
- [ ] DIV-P12-013 Add clean-checkout CI and integration smoke tests.
- [ ] DIV-P12-014 Publish compatibility matrix for Corpus, ORM, ARSY and Divine versions.

### Acceptance
- No fake or stub platform integration is described as production-ready.
- All authorization checks are enforced server-side.
- Query and graph operations have bounded resource usage.
- A clean checkout can build, test and validate the package.
- Production release requires all mandatory integration tests and security gates to pass.

---

# 6. First proof-of-value vertical slice

Do not attempt all religions, all texts or all ontologies in the first release.

Use a small, rights-cleared or synthetic dataset and the existing Corpus pilot strategy where appropriate.

## Pilot objectives
- Demonstrate one canonical source-to-claim-to-evidence trace.
- Demonstrate two scoped interpretations without forced merge.
- Demonstrate one disputed/contradictory evidence case.
- Demonstrate one cross-ontology mapping candidate that requires review.
- Demonstrate one abstention due to insufficient evidence.
- Demonstrate one reproducible research report.
- Demonstrate one AI candidate that remains unpromoted until human review.

## Pilot acceptance
- All source text is rights-cleared or synthetic and clearly labeled.
- No generated sacred text is included.
- Every claim links to evidence and provenance.
- Every interpretation has explicit scope and method.
- Disagreement is visible.
- The same release and method versions reproduce the same deterministic outputs.
- Human reviewers can inspect and reject machine candidates.
- The pilot does not claim theological authority.

---

# 7. Test strategy and quality gates

## Unit tests
- addon registry and dependency graph;
- identifier and scope handling;
- ontology mapping semantics;
- epistemic state distinctions;
- rule evaluation and derivation traces;
- abstention behavior;
- provenance and release manifests.

## Contract tests
- Corpus core records and profile compatibility;
- Corpus release pinning and projection rebuild;
- ORM adapter when available;
- ARSY provider when available;
- ZILL and MIZAN interfaces when available;
- standards export/import.

## Property and invariant tests
- unknown never silently becomes false;
- labels never establish identity;
- similarity never establishes equivalence;
- evidence absence never proves denial;
- scope never widens without an explicit rule;
- conflicting claims remain representable;
- every derived edge has provenance;
- historical assessments remain addressable;
- rights restrictions are never bypassed;
- AI candidates cannot become canonical without review.

## Evaluation metrics
- evidence attribution precision;
- citation resolution accuracy;
- retrieval precision/recall by relevance class;
- ontology mapping reviewer acceptance and false-equivalence rate;
- abstention precision and recall;
- contradiction preservation rate;
- reproducibility rate;
- source/provenance completeness;
- human-review agreement with disagreement reporting;
- performance and cost by query class.

Do not optimize a single aggregate score at the expense of traceability, fairness, coverage or abstention quality.

---

# 8. Explicitly deferred decisions

The following must not be chosen prematurely:

- graph database vendor;
- vector database vendor;
- mandatory RDF/OWL storage;
- Python runtime requirement;
- universal theological taxonomy;
- universal source reliability ranking;
- global confidence threshold;
- global doctrinal authority ranking;
- automated authenticity verdict;
- automated cross-religion equivalence;
- AI model/provider lock-in;
- broad public data ingestion before rights review;
- large-scale UI before domain contracts stabilize.

Each requires evidence, a benchmark, a use case and an ADR.

---

# 9. Definition of Done

Divine v1 is not complete merely because it compiles.

A release candidate must demonstrate:

- stable package exports and addon manifests;
- clean dependency graph;
- documented Corpus ownership boundary;
- pinned Corpus compatibility;
- plural ontology and scoped claims;
- explicit epistemic states and abstention;
- provenance-aware evidence graph;
- deterministic, explainable reasoning;
- preserved disagreement and historical revision;
- reproducible research manifests;
- human-governed AI candidate promotion;
- rights-aware data handling;
- interoperability mappings with loss reports;
- complete unit, contract, invariant and integration tests;
- clean-checkout CI;
- operational documentation and migration/recovery guidance.

---

# 10. Initial execution order

1. Complete Phase 0 architecture and repository alignment.
2. Complete Phase 1 pure TypeScript core.
3. Complete Phase 2 Corpus adapter.
4. Complete Phase 3 ontology intelligence.
5. Complete Phase 5 epistemic boundary engine.
6. Complete Phase 6 evidence graph.
7. Complete Phase 4 revelation/theology profiles.
8. Complete Phase 7 reasoning and MIZAN adapter contract.
9. Complete Phase 8 research reproducibility.
10. Complete Phase 9 preservation and governance.
11. Complete Phase 11 standards interoperability.
12. Complete Phase 10 AI assistant only after deterministic and governance foundations.
13. Complete Phase 12 runtime integration when ORM and ARSY are genuinely available.

Phases may be parallelized only when their dependency contracts are stable. Do not parallelize implementation by creating competing definitions of the same domain object.

---

# 11. Current status

- [x] Research and initial architecture synthesis documented.
- [x] Existing MOONWITNESS repository reality checked: packages/divine was absent at the time this TODO was created.
- [x] Existing MoonWitness Corpus profiles and core ownership inspected.
- [x] GitHub project patterns and research-paper references recorded.
- [x] Standards interoperability targets recorded.
- [x] Non-goals and epistemic/religious governance boundaries defined.
- [x] Detailed phases, tasks, dependencies and acceptance criteria drafted.
- [x] Phase 0 architecture baseline and ADRs committed; repository-audit re-read, non-Corpus adapter ports and license governance follow-ups remain.
- [x] Phase 1 foundational core, addon registry, lifecycle and tests implemented; example/clean-runtime proof and CI verification remain.
- [x] Phase 2 read-only Corpus adapter and migration runbook implemented; profile-specific mapping, round-trip tests and stale-projection invalidation remain.
- [x] Phase 3 ontology intelligence core implemented (candidate generator and full standards interchange deferred).
- [x] Phase 4 scoped revelation/theology research profiles implemented.
- [x] Phase 5 SIDRAT epistemic boundary engine implemented.
- [ ] Remaining profile-specific and external interoperability tasks.

**Execution update (2026-11-08):** Phase 0–2 merged to `main`; Phases 3–5 foundational domain modules are implemented on `feat/divine-phases-3-5`, pending CI/review. Not a production release. The full Corpus repository has NOT been migrated: this connection has read-only access. See `docs/CORPUS-MIGRATION.md`.
