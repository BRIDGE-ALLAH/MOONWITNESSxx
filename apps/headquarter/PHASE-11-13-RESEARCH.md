# MOONWITNESS Phase 11–13 — Research & Design Notes

**Reviewed:** 2026-11-08  
**Scope:** replayable decision evidence, decision debt, uncertainty-aware human governance.  
**Caution:** research, GitHub projects, and Reddit threads inform design hypotheses; they do not establish that a MOONWITNESS concept is globally unprecedented.

## Research papers and preprints

1. **A Neurosymbolic Multi-Agent System for Explainable and Traceable Decision-Making in Organizational Contexts** (IEEE Access, 20 May 2026). DOI: https://doi.org/10.1109/ACCESS.2026.3695444. Relevant to provenance-aware knowledge graphs, constrained LLM interfaces, and traceability evaluation.
2. **TRACE: Tamper-Resistant Accountability and Cryptographic Evidence for Multi-Agent AI Systems** (IEEE BigDataSecurity 2026). DOI: https://doi.org/10.1109/BigDataSecurity69476.2026.00021. Relevant to cryptographic commitments, Merkle evidence, component attribution, and historical reconstruction.
3. **LedgerRAG: Governance-Driven Agentic Chain of Retrieval for Dynamic Knowledge Scenarios** (Electronics, 2026, 15(7), 1376). DOI: https://doi.org/10.3390/electronics15071376. Relevant to claim-level evidence ledgers, temporal validity, conflict signals, and refresh/stopping policy.
4. **From Business Events to Auditable Decisions: Ontology-Governed Graph Simulation for Enterprise AI** (arXiv:2604.08603, 8 Apr 2026; preprint). https://arxiv.org/abs/2604.08603. Relevant to event → isolated simulation → decision pipelines and replayable graph traces. Treat reported results as author-reported and independently unverified here.
5. **Controlled Agentic AI Systems: A Governance-Driven Architecture for Auditable and Reproducible Decision Pipelines** (Machine Learning and Knowledge Extraction, 8 May 2026). DOI: https://doi.org/10.3390/make8050125. Relevant to execution contracts, human authorization, verification, and rollback boundaries.
6. **Temporal Monitoring of Agent Beliefs Under Uncertainty with Subjective LTL** (AAAI Symposium Series, 18 May 2026). DOI: https://doi.org/10.1609/aaaiss.v8i1.42574. Relevant to monitoring evolving belief states under uncertainty.
7. **Composable Trust Infrastructure for Manufacturing Knowledge Graphs** (arXiv:2608.21418, 13 Aug 2026; preprint). https://arxiv.org/abs/2608.21418. Relevant to composing SHACL validation, PROV-O provenance, bi-temporal versioning, and decision traceability.
8. **Auditable LLM Autonomy for Operational Decision-Making** (2026 review). DOI: https://doi.org/10.32604/cmc.2026.082270. Relevant to evidence, decision-trace, and outcome planes.

## GitHub / open-source signals

- **MoongladeAI/provenance** — local-first cryptographic provenance for Markdown and agent memory, including Ed25519 signatures, RFC 3161 timestamps, and Merkle-tree concepts. https://github.com/MoongladeAI/provenance
- **agentralabs/agentic-memory** — append-only content-addressed memory, temporal/causal indexes, and replay/impact query ideas. https://github.com/agentralabs/agentic-memory
- **Metaworkers-ai/governedmemory** — governed writes/retrieval, purpose binding, provenance, quarantine, and audit graph. https://github.com/Metaworkers-ai/governedmemory
- **ZibbyDev/agent-graph-memory** — temporal graph versions, provenance-aware edges, replay, and bounded path traversal. https://github.com/ZibbyDev/agent-graph-memory
- **sipyourdrink-ltd/bernstein** — declarative agent governance and replayable records. https://github.com/sipyourdrink-ltd/bernstein
- **irresi/awesome-agentic-knowledge-base** — empirical map of 46 agent repositories and their storage/retrieval patterns. https://github.com/irresi/awesome-agentic-knowledge-base

These are implementation references, not dependencies. Review licenses, threat models, maintenance, and benchmark methodology before adoption.

## Reddit / practitioner signals

- r/LocalLLaMA, **“We've built memory into 4 different agent systems...”** (11 Feb 2026): warns that a single retrieval mode can miss exact identifiers or relational context; recommends entity resolution and hybrid retrieval. https://www.reddit.com/r/LocalLLaMA/comments/1r21ojm/weve_built_memory_into_4_different_agent_systems/
- r/LocalLLaMA, **“Analyzed 8 agent memory systems end-to-end”** (18 Feb 2026): compares explicit graph, temporal, and hybrid memory models. https://www.reddit.com/r/LocalLLaMA/comments/1r8cnwq/analyzed_8_agent_memory_systems_endtoend_heres/
- r/LocalLLaMA, **“What is the current Memory Meta?”** (8 Jul 2026): practitioner reports that background memory writes do not guarantee agents will retrieve memory at the right time. https://www.reddit.com/r/LocalLLaMA/comments/1uqfh7r/what_is_the_current_memory_meta/

Reddit is anecdotal evidence. Use it to generate hypotheses, not to set production policy.

## Product ideas worth testing

1. **Decision Debt Compiler:** compile stale/missing/contradictory support into a review queue with downstream impact paths. Measure precision/recall against expert-labelled decisions.
2. **Replay Capsule:** package baseline, ordered operations, engine/schema versions, output digest, and later trusted server attestation. Hash integrity and signer authenticity are distinct properties.
3. **Uncertainty Envelope:** keep low/base/high and missingness visible; later separate epistemic uncertainty (lack of knowledge) from aleatoric variability (inherent randomness).
4. **Belief Drift Sentinel:** compare what an agent asserted at decision time with later evidence, without rewriting the historical assertion. Emit a drift event and dependent-decision review list.
5. **Counterfactual Blast-Radius Map:** combine Scenario Forge deltas with Decision Graph causes/dependency paths to show which downstream decisions may be affected. Must remain sandbox-only until reviewed.
6. **Evidence Expiry Budget:** assign explicit freshness policies by evidence class and decision criticality, then measure how much of the active decision portfolio is running on expired evidence.
7. **Proof-Carrying Action Proposal:** every future action request carries preconditions, evidence references, permission scope, idempotency key, expected effect, rollback plan, and verification criteria. The server—not the LLM—validates and authorizes it.

## MOONWITNESS differentiation hypothesis

A defensible direction is an integrated **Evidence-to-Outcome Governance Loop**:
- source evidence with temporal provenance;
- compile decision debt and contradiction exposure;
- replay counterfactuals in isolated snapshots;
- gate uncertain or incomplete proposals;
- record human approval and verified outcome as new append-only events;
- use outcome drift to calibrate future thresholds.

No claim is made that individual components are unprecedented. Potential differentiation lies in the end-to-end composition and its measurable governance guarantees. Validate through prior-art review, independent security assessment, operator studies, and public benchmark tasks.

## Proposed evaluation metrics

- Replay: tamper-detection rate, deterministic replay success, schema migration compatibility.
- Decision debt: precision/recall, time-to-review, stale-evidence escape rate, downstream impact recall.
- Governance: unsafe pass-through rate, false-block rate, calibration error, human override rate.
- Operations: p95 review latency, audit completeness, rollback success, policy drift.
