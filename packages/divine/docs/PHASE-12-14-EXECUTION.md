# Divine Phases 12–14 — Execution Record

**Branch:** `feat/divine-phases-12-14-runtime-eval-temporal`
**Status:** implemented as pure-domain vertical slices; production integration remains gated.

## Phase 12 — Platform Integration Readiness Gate

Added a fail-closed readiness assessor for Corpus, ORM, ARSY, ZILL and MIZAN adapter descriptors. It checks required ports, minimum versions, required capabilities, duplicate adapter claims, contract verification and production-ready declarations. It reports blockers rather than manufacturing stub adapters.

This is intentionally not a fake ORM/ARSY/ZILL/MIZAN implementation. The current repository audit says the production ORM and ARSY core are not available; platform integration cannot honestly be marked complete until real contracts exist. Rights and authorization remain owned by ZILL; Corpus remains canonical; MIZAN remains assessment authority.

## Phase 13 — Evidence Evaluation Harness

Added deterministic benchmark aggregation for evidence precision/recall/F1, citation resolvability, abstention accuracy and contradiction preservation. Per-case results and explicit limitations are returned. Duplicate IDs and duplicate evidence labels are rejected.

The harness measures agreement with supplied adjudicated labels, not metaphysical truth, source authenticity or scholarly correctness. It does not invent benchmark data. Real evaluation needs rights-cleared sources, domain experts, inter-rater agreement, stratification by language/source/tradition and frozen train/dev/test splits.

## Phase 14 — Epistemic Time Machine

Added release-to-release structural diff for claims, evidence references, provenance references, graph edges, ontology versions and method versions. The diff identifies additions, removals and modifications without claiming that a changed record is more or less true.

Every output is explicitly labelled `structural-change-only`. Same-release comparisons warn that changes may reflect review/method/ontology state rather than source changes. This is a foundation for future bitemporal event history and reproducible counterfactual analysis, not a full temporal database.

## Research signals and prior-art review

- Kejriwal (2026), *Semantics for Science*, argues for first-class evidence traces, provenance, uncertainty, scope, contradiction and temporal evolution: https://www.isi.edu/results/publications/82525/semantics-for-science-toward-a-massive-scale-evidence-centric-scientific-knowledge-graph/
- An (2026), *An Evidence-Centric Knowledge Management System for Humanities Research Powered by Multimodal Large Language Models*, proposes stable evidence units, schema validation, claim-level verification and human review; reports improved evidence-pointer resolvability in its controlled study: https://www.mdpi.com/2079-8954/14/5/552
- Chen et al. (ICLR 2026), *Beyond Entity Correlations: Disentangling Event Causal Puzzles in Temporal Knowledge Graphs*, studies event-level causal disentanglement and counterfactual detection: https://proceedings.iclr.cc/paper_files/paper/2026/hash/cafcbf5d00a961a05bd5875c17ef0fe7-Abstract-Conference.html
- *A counterfactual and risk temporal knowledge graph framework for interpretable project risk management* (2026) links temporal graphs and constrained counterfactuals: https://doi.org/10.1016/j.engappai.2026.114568
- *PQ-EID: Provenance-Quotient Evidential Interaction Decomposition and Certification in Web Question Answering* (2026) explicitly analyzes evidence coalitions and source dependence: https://doi.org/10.3390/fi18110582
- *Generating Counterfactual Temporal Motifs* (2026) explores counterfactual temporal graph structures: https://doi.org/10.1007/s41019-025-00321-x

## Practitioner signals

- Reddit practitioners report that citation attribution often degrades between retrieval and generation; stable deterministic chunk IDs and request-scoped ID maps make invented citations detectable: https://www.reddit.com/r/Rag/comments/1uuke7m/the_rag_citation_problem_why_i_ended_up_tracking/
- A Reddit design for religious-text RAG highlights verse-level locators, original-script display, lineage filters and routing exact-text queries separately from thematic retrieval: https://www.reddit.com/r/Rag/comments/1u16kk3/rag_over_religious_source_texts_with_verselevel/
- Reddit discussion on GraphRAG points out that retrieval coverage is not proof that a retrieved subgraph entails a claim: https://www.reddit.com/r/Rag/comments/1wgwryf/graphrag_retrieves_a_plausible_subgraphbut_can_it/

## GitHub ecosystem scan

- GitHub's knowledge-graph topic shows active work in deterministic graph extraction without vector stores (Graphify) and interactive graph exploration (Understand-Anything): https://github.com/topics/knowledge-graph
- A November 2026 third-party tracker lists Graphify, Understand-Anything, MiroFish and NVIDIA Auto Ontology among high-growth knowledge-graph projects. Tracker rankings are snapshots, not official GitHub Trending: https://github.locker/topics/knowledge-graph
- The GraphRAG topic also shows graph-native context/provenance projects such as Semantica and Neo4j's LLM Graph Builder: https://github.com/topics/graph-rag

## Additional unique capabilities extracted from the superseded PR lines

- **Witness-Family Firewall:** explicit family-level independence assessment and train/test leakage detector; unknown family assignments are quarantined rather than treated as independent.
- **Proof-Carrying Research:** a deterministic certificate binds conclusion, rule, scope, Corpus release, witness graph digest, evidence node IDs, graph edge IDs and provenance references. Structural verification detects mismatch; the fingerprint is not a digital signature and does not prove truth.
- **TEI/IIIF fidelity controls:** minimal TEI P5 and IIIF Presentation 3 exporters plus Semantic Loss Budget were retained from the superseded Phase 9–11 branch. IIIF placeholder dimensions remain a publication blocker.

## New research prototypes (not novelty claims)

1. **Epistemic Time Machine** — now implemented as a structural release diff; next step is bitemporal event storage only after a canonical event-history contract exists.
2. **Evidence Quorum** — use provenance quotienting and witness-family independence to estimate independent evidential coalitions; unknown dependence forces abstention.
3. **Counterfactual Evidence Surgery** — remove one evidence node/edge, recompute affected derivations and calculate minimal cut sets that defeat a conclusion.
4. **Citation Mutation Lab** — fuzz offsets, Unicode normalization, OCR confusables, RTL marks and near-match quotes; require exact source locator verification.
5. **Evidence-Interaction Attribution** — estimate whether evidence items add unique, redundant or synergistic support; adapt PQ-EID-style decomposition only with transparent assumptions and human review.

No claim is made that these ideas are unprecedented. The implementation gap and novelty must be tested by systematic prior-art search, baselines and public benchmarks.
