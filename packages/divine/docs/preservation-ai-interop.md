# Divine Phases 9–11 — Preservation, AI Governance and Interoperability

## Phase 9 — LAWH preservation
The preservation module builds deterministic SHA-256 manifests over sorted JSON, verifies them, appends hash-chained decision records, verifies the chain, and exposes an explicit rights gate for read/display/export/AI processing. Corrections and supersessions are new events; prior decisions are not rewritten.

A digest is tamper evidence, not a digital signature, trusted timestamp, legal proof, or guarantee of source authenticity. Signing is deferred until key custody and verification policy exist. Rights checks consume an upstream decision; they are not a replacement for Corpus rights metadata or ZILL authorization.

## Phase 10 — AI research assistant
The AI module is provider-neutral. A caller supplies an extractor adapter; the package itself makes no network or model calls. Every candidate must carry source refs, provenance refs, exact text spans, model/provider/version metadata, prompt/task/pipeline versions, input release and rights references. Input is explicitly untrusted. Exact span verification rejects fabricated or mismatched quotations.

Only an identified human reviewer can accept/reject/request revision. Accepted output becomes a promotion envelope marked `writesCanonicalCorpus: false`; no Corpus write port is present. This is a governance boundary, not a guarantee that reviewers are correct. Production adapters still need ZILL authorization, audit, rate limits, data minimization, prompt-injection isolation and language-specific evaluation.

## Phase 11 — standards interoperability
Implemented deterministic bounded exports:
- W3C PROV-O JSON-LD subset for entity/activity/agent and provenance relations.
- W3C SKOS JSON-LD subset for concept schemes, multilingual labels, broader and related links.
- TEI P5 minimal XML text profile with escaped text and explicit fidelity loss.
- IIIF Presentation API 3 minimal Manifest/Canvas/painting annotation shape.
- W3C Web Annotation with text position and quote selectors.

Every exporter returns a report. The TEI profile does not encode manuscript hands, variants, apparatus, layout or critical apparatus. IIIF canvas dimensions are placeholders (1×1) until supplied by a trusted media adapter; do not publish this output as a production manifest without real dimensions and rights/access metadata. No SHACL validator or round-trip parser is claimed.

## Research and design signals
- F(AI)2R (2026) proposes machine-readable provenance for AI-assisted research artifacts and a human-only verification rung: https://arxiv.org/abs/2607.25637
- Chhetri et al. (WWW Companion 2025) survey 23 assertion/evidence/provenance ontologies, supporting reuse over a new universal vocabulary: https://doi.org/10.1145/3701716.3715483
- Provenance-aware modular extraction from historical tabular images (HHAI 2026) argues for inspectable intermediate stages and source-cell traceability: https://doi.org/10.3233/FAIA260519
- W3C PROV-O: https://www.w3.org/TR/prov-o/
- W3C SKOS: https://www.w3.org/TR/skos-reference/
- TEI P5 4.12.0: https://www.tei-c.org/guidelines/p5/
- IIIF Presentation API 3.0: https://iiif.io/api/presentation/3.0/

## Practitioner and ecosystem signals
- Reddit discussion on claim-level proof of GraphRAG subgraphs argues retrieval coverage is not entailment: https://www.reddit.com/r/Rag/comments/1wgwryf/graphrag_retrieves_a_plausible_subgraphbut_can_it/
- A GitHub survey of 47 agent knowledge-base repositories reports wide variation in storage and extraction choices; several useful systems work without a graph DB, while temporal memory and explicit human curation remain uncommon: https://github.com/irresi/awesome-agentic-knowledge-base
- GitHub knowledge-graph trend snapshots (Nov 6–7, 2026) show Graphify, LightRAG and NVIDIA Auto Ontology as useful implementation references, not dependencies: https://github.locker/topics/knowledge-graph

## Next research prototypes (not novelty claims)
1. **Epistemic Time Machine:** reproducible diff between any two Corpus releases; show which source, selector, rights status, ontology mapping, rule and reviewer decision changed a derived conclusion.
2. **Evidence Quorum Without Popularity Bias:** estimate source-dependence clusters using explicit witness-family and provenance edges; count independent transmission paths, not URLs or repeated citations. Abstain when family relationships are unknown.
3. **Semantic Loss Budget:** every import/export declares a machine-readable budget of lost structures (variants, uncertainty, script, layout, provenance, rights); block export when loss exceeds a profile's policy.
4. **Adversarial Citation Fuzzer:** mutate quotations, Unicode normalization, OCR confusables, RTL punctuation and span offsets; ensure the system rejects near-match citations rather than silently normalizing them into evidence.
5. **Counterfactual Evidence Surgery:** remove one evidence edge or provenance step, recompute the proof trace, and report the minimal evidence set whose removal defeats a conclusion.
6. **Rights-Aware Research Compiler:** compile query plans into allowed retrieval, display, export and AI-processing operations; restricted sources yield metadata-only or explicit abstention, never accidental leakage.

These are differentiated research directions, not claims that nobody has ever proposed them. Novelty requires a structured prior-art review, implementation comparison and independent evaluation.

## Remaining acceptance gates
The current code is a pure-domain vertical slice. Before production: validate hashes against cross-runtime canonicalization test vectors; add signature support only after key management; connect real rights/ZILL checks; add SHACL validation, TEI/IIIF schema validation, round-trip tests, actual IIIF dimensions, selector adapters, language-specific AI evaluation, prompt-injection tests, human review authorization and integration with Corpus promotion workflows.
