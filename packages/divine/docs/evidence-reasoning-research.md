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
1. **Proof-Carrying Research (PCR):** a first experimental certificate API now packages conclusion, premise refs, evidence/provenance refs, graph-edge refs, rule/version, scope and pinned Corpus release. A separate deterministic verifier checks the graph/release references and certificate fingerprint. This is more useful than a citation list because it tests whether cited evidence participates in the derivation; it is not a cryptographic signature or proof of truth.
2. **Witness-Family Firewall:** evaluation splits and retrieval deduplication use Corpus lineage/witness families, not URL or document IDs, to prevent near-duplicate leakage and false corroboration.
3. **Epistemic Time-Travel:** compare two pinned Corpus releases and show which conclusions changed, which evidence was added/withdrawn, and which rule version caused the change. This becomes a reproducible “why did our answer change?” debugger.
4. **Negative-Space Ledger:** record searched-but-unavailable, restricted, missing and out-of-scope evidence separately from negative evidence. Absence becomes auditable without becoming denial.
5. **Counterfactual Evidence Lab:** remove or challenge one evidence edge and recompute the derivation to expose the minimal evidence set on which a conclusion depends. This should be a deterministic research tool, not a truth score.

These ideas are not claimed to be unprecedented. They are differentiated combinations worth prototyping and benchmarking against established systems.

## Reddit / practitioner signal
Community discussions repeatedly report that multi-hop retrieval can lose relational context, citation identity degrades through chunking/re-keying, and hybrid/vector/graph strategies vary by corpus and query mix. Practical implication: deterministic canonical refs, exact-first retrieval, channel-specific metrics and citation verification should precede expensive embeddings or agent loops. Reddit posts are anecdotal, not peer-reviewed evidence.

## Explicit non-goals
No graph database, vector database, embedding model, Python runtime, network call, AI provider, Corpus write, universal confidence score, or source-independence inference is added. The graph and research runner are pure TypeScript interfaces/functions over supplied data.

## References
- Kejriwal (2026), *Semantics for Science*: https://www.isi.edu/results/publications/82525/semantics-for-science-toward-a-massive-scale-evidence-centric-scientific-knowledge-graph/
- Chhetri et al. (2025), *Bridging the Scientific Knowledge Gap and Reproducibility*: https://doi.org/10.1145/3701716.3715483
- SciGraph-LLM (WSDM Companion 2026): https://doi.org/10.1145/3779211.3793169
- STEM (ACL 2026): https://aclanthology.org/2026.acl-long.329/
- Programmatic Graph Reasoning (EMNLP Findings 2025): https://aclanthology.org/2025.findings-emnlp.293/
- PaGLR (2026): https://doi.org/10.1007/s44443-026-00763-x
- ArcRAG (arXiv, 2026-11-04): https://arxiv.org/abs/2611.06481
- GitHub trending snapshot (Nov 7, 2026): https://github.locker/topics/knowledge-graph
- Graphify deterministic code/docs graph approach: https://github.com/Graphify-Labs/graphify
- NVIDIA Auto Ontology: https://github.com/NVIDIA/auto-ontology
- LightRAG: https://github.com/HKUDS/LightRAG
- Hindsight agent memory: https://github.com/vectorize-io/hindsight
- Reddit practitioner discussion on claim-level GraphRAG verification: https://www.reddit.com/r/Rag/comments/1wgwryf/graphrag_retrieves_a_plausible_subgraphbut_can_it/
- Reddit discussion on citation IDs surviving chunk/retrieval pipelines: https://www.reddit.com/r/LangChain/comments/1uukcbf/the_rag_citation_problem_why_i_ended_up_tracking/
- Reddit discussion on query-dependent retrieval strategy trade-offs: https://www.reddit.com/r/LocalLLaMA/comments/1rxzmcd/benchmarked_5_rag_retrieval_strategies_on_code/
