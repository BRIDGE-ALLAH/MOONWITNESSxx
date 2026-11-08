# MOONWITNESS — Phase 9–10 Research & Product Bets

**Review date:** 2026-11-08  
**Scope:** Decision Graph Explorer and Scenario Arena  
**Status:** desk research and implementation hypotheses; not a claim of novelty or empirical validation.

## Research signals

1. Staudinger et al. (2025), *Knowledge graph support for descriptive business analytics*: decision context and provenance help preserve interpretability. DOI: https://doi.org/10.1007/s40622-025-00432-4
2. Dibowski (2024), *Full Traceability and Provenance for Knowledge Graphs*: graph change history and provenance should be first-class, not just current snapshots. DOI: https://doi.org/10.3233/FAIA241309
3. *Construction of intelligent decision support systems through integration of retrieval-augmented generation and knowledge graphs* (Scientific Reports, 2025): combines structured knowledge, retrieval, and layered explanations. DOI: https://doi.org/10.1038/s41598-025-19257-3
4. *Simulation-based generation and analysis of multidimensional future scenarios with time series clustering* (2024): studies multiple dynamic outcomes and post-generation scenario evaluation. DOI: https://doi.org/10.1002/ffo2.194
5. Laudy (2026), *The Digital Twin Counterfactual Framework*: proposes validation tiers, sensitivity, and uncertainty boundaries. Preprint: https://arxiv.org/abs/2604.01325; treat as a proposal, not settled consensus.

## Open-source signals checked 2026-11-08

- NVIDIA/auto-ontology: semantic layer, ontology reconciliation, certified definitions, lineage/provenance, MCP/API. https://github.com/NVIDIA/auto-ontology
- Graphify-Labs/graphify: deterministic AST-derived code graph, explainable edges, graph-aware PR review. https://github.com/Graphify-Labs/graphify
- irresi/awesome-agentic-knowledge-base surveys 47 agent repositories and their storage/retrieval patterns. https://github.com/irresi/awesome-agentic-knowledge-base

## Community signal

Reviewed r/LocalLLaMA discussions:
- “Analyzed 8 agent memory systems end-to-end” (2026-02-18): compares explicit graph/temporal memory and hybrid retrieval. https://www.reddit.com/r/LocalLLaMA/comments/1r8cnwq/analyzed_8_agent_memory_systems_endtoend_heres/
- “We've built memory into 4 different agent systems...” (2026-02-11): anecdotal warning against a single retrieval mode; highlights entity resolution and hybrid retrieval. https://www.reddit.com/r/LocalLLaMA/comments/1r21ojm/weve_built_memory_into_4_different_agent_systems/
Community posts are anecdotal, not benchmarks.

## Product bets to validate

1. **Decision Debt Compiler:** continuously find active decisions whose supporting evidence is stale, missing, or superseded; emit exact dependency paths and a human review queue. Never auto-rewrite decisions.
2. **Contradiction Budget:** show unresolved material counter-evidence and downstream surfaces still relying on the decision; do not average contradictions into a fake confidence score.
3. **Replay Capsule:** content-addressed baseline ID + schema version + engine version + assumptions + ordered operations + result digest for tamper-evident replay.
4. **Uncertainty Envelope:** low/base/high parameter bounds, missing-data flags, sensitivity ranking; separate epistemic uncertainty from stochastic variability.
5. **Decision-to-Outcome Calibration:** preserve original decision and expected outcome; attach observed outcome later as new evidence without rewriting history.
6. **Provenance-aware Agent Firewall:** agent recommendations must cite typed source nodes and snapshot versions; unsupported claims remain hypotheses.

## Recommended technical sequence

- Start read-only and visibly synthetic.
- Define ARSY versioned read contracts with workspace scope, permission, source timestamp, freshness, schema version, pagination, and redaction.
- Use append-only events for decision/evidence changes; derive graph projections asynchronously. Consider bitemporal valid-time and recorded-time fields.
- Start with Postgres relational tables and indexed adjacency queries; adopt a graph DB only when query shape and scale justify it.
- Keep scenario definitions/replay capsules separate from execution systems.
- Evaluate provenance completeness, contradiction recall, stale-decision precision, review time, replay determinism, sensitivity stability, and calibration.

## Novelty statement

No claim is made that these ideas have never existed. MOONWITNESS differentiation is the integrated governance loop: evidence freshness → decision debt → counterfactual rehearsal → observed outcome feedback → append-only provenance. Novelty requires prior-art search, user studies, and benchmark comparison.
