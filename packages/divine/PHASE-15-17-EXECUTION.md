# Divine Phases 15–17 — Execution record

## Phase 15 — Counterfactual Evidence Surgery
Removes selected witness-graph edges, recomputes reachability, reports lost nodes and bounded exact minimal cut sets (maximum 16 edges). It validates witness graph provenance first. This is structural dependency analysis only; it does not infer causal effects or truth.

## Phase 16 — Evidence Interaction & Provenance Quotient
Implements bounded Möbius decomposition over a supplied coalition-score table. It reports first- through fourth-order interaction dividends, witness-family entropy/concentration and stability of a target interaction sign across declared alternative provenance partitions. Missing coalition scores fail closed; missing witness-family assignments remain unknown. Diagnostics describe evaluator-defined scores, not truth probabilities or proof of independence.

The design is informed by PQ-EID (Zub et al., Future Internet 2026), which analyzes claim-plus-provenance evidence units and cautions that incorrect source partitions can distort interaction signs. The paper's own findings emphasize that sign certification depends on structural coverage assumptions; Divine does not claim those statistical guarantees.

## Phase 17 — Citation Mutation Lab
Validates exact source-span selectors without silently normalizing text. Generates deterministic mutations for offset drift, truncation, zero-width insertion, bidi controls, whitespace changes, Unicode normalization and common confusable substitutions. Reports false acceptances; it does not modify canonical Corpus data.

## Research reviewed
- Zub, Dronyuk & Mulesa (2026), PQ-EID: Provenance-Quotient Evidential Interaction Decomposition and Certification in Web Question Answering: https://doi.org/10.3390/fi18110582
- Nussbaum-Hoffer et al. (EMNLP 2026), LLM Explainability with Counterfactual Chains and Causal Graphs: https://aclanthology.org/2026.emnlp-main.2152/
- Wu et al. (AAAI 2026), AgentGraph trace-to-graph robustness testing: https://doi.org/10.1609/aaai.v40i48.42393
- Reddit practitioners describe citation drift and stable source-span IDs: https://www.reddit.com/r/Rag/comments/1uuke7m/the_rag_citation_problem_why_i_ended_up_tracking/
- Reddit discussion warns that GraphRAG retrieval coverage is not entailment: https://www.reddit.com/r/Rag/comments/1wgwryf/graphrag_retrieves_a_plausible_subgraphbut_can_it/
- GitHub ecosystem survey of 47 agent knowledge-base repositories: https://github.com/irresi/awesome-agentic-knowledge-base
- GitHub knowledge-graph topic/trending snapshot (Nov 7, 2026): https://github.com/topics/knowledge-graph and https://github.locker/topics/knowledge-graph

## Acceptance boundaries
No graph database, AI provider, model inference, Corpus writes, causal claim, truth score, probabilistic independence claim, complete Unicode confusable catalog or multilingual benchmark is added. All outputs require rights-cleared evaluation and expert review before production use.