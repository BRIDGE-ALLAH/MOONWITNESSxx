# Divine Phases 6–8: Evidence, Reasoning and Research

## What is implemented
- **Phase 6 — Evidence graph:** disposable projection contracts over pinned Corpus releases; distinct support/challenge/qualification/context/quotation/mention edges; selectors, source and provenance per edge; explicit (never URL-inferred) source-independence assessments; bounded deterministic traversal; unresolved contradiction views; stable serialization.
- **Phase 7 — Defeasible reasoning:** versioned, method-bound rules; typed premises/conclusions/exceptions; exact scope matching; deterministic execution; trace of premises/evidence/provenance; defeaters and conflicting conclusions remain explicit. No probabilistic or theological verdict engine.
- **Phase 8 — Research orchestration:** pinned release and ontology/method versions; exact → lexical → structural → optional semantic channel order; channel-labelled results; witness-family grouping; reproducible manifests; Markdown/JSON export; precision/recall/MRR evaluation.

## Research-informed decisions
- Evidence-Centric Scientific Knowledge Graphs motivate assertion/evidence/provenance/scope/uncertainty as first-class structures (Kejriwal, 2026).
- The survey of 23 assertion/evidence/provenance ontologies motivates reuse and mapping rather than a new universal vocabulary (Chhetri et al., WWW Companion 2025).
- SciGraph-LLM (WSDM Companion 2026) motivates strict source-span grounding and human review for extracted claims; the Divine core remains provider-neutral and does not perform extraction.
- STEM (ACL 2026) and PaGLR (2026) motivate query-structure and path-aware evidence retrieval; Divine exposes structural paths before any LLM.
- PGR (EMNLP Findings 2025) motivates explicit executable reasoning steps instead of opaque model-generated conclusions.
- ArcRAG (arXiv, 2026-11-04) motivates construction-agnostic query-time graph interfaces; Divine consumes typed graph contracts without binding to a particular graph DB.

## New high-upside research directions (proposals, not novelty claims)
1. **Proof-Carrying Research (PCR):** every answer/report ships a compact derivation certificate (premise refs, evidence selectors, rule/version, source release hash). A separate verifier can reject missing, stale or scope-invalid support. This is more useful than a citation list because it tests whether the cited evidence actually participates in the derivation.
2. **Witness-Family Firewall:** evaluation splits and retrieval deduplication use Corpus lineage/witness families, not URL or document IDs, to prevent near-duplicate leakage and false corroboration.
3. **Epistemic Time-Travel:** compare two pinned Corpus releases and show which conclusions changed, which evidence was added/withdrawn, and which rule version caused the change. This becomes a reproducible “why did our answer change?” debugger.
4. **Negative-Space Ledger:** record searched-but-unavailable, restricted, missing and out-of-scope evidence separately from negative evidence. Absence becomes auditable without becoming denial.
5. **Counterfactual Evidence Lab:** remove or challenge one evidence edge and recompute the derivation to expose the minimal evidence set on which a conclusion depends. This should be a deterministic research tool, not a truth score.

These ideas are not claimed to be unprecedented. They are differentiated combinations worth prototyping and benchmarking against established systems.

## Reddit / practitioner signal
Community discussions repeatedly report that multi-hop retrieval can lose relational context, citation identity degrades through chunking/re-keying, and hybrid/vector/graph strategies vary by corpus and query mix. Practical implication: deterministic canonical refs, exact-first retrieval, channel-specific metrics and citation verification should precede expensive embeddings or agent loops. Reddit posts are anecdotal, not peer-reviewed evidence.

## Explicit non-goals
No graph database, vector database, embedding model, Python runtime, network call, AI provider, Corpus write, universal confidence score, or source-independence inference is added. The graph and research runner are pure TypeScript interfaces/functions over supplied data.
