# MOONWITNESS Trust Boundary — Phases 33–35

**Date:** 2026-11-08  
**Branch:** `feat/moonwitness-phases-30-32-trust-boundary`  
**Status:** Implemented as framework-neutral domain primitives; persistence and runtime enforcement remain integration gates.

## Phase 33 — Revocation Propagation Graph
Added a dependency graph that propagates source revocation through evidence, claims, memories, summaries, caches, decisions and actions. Derived content is invalidated; decisions/actions are frozen. Reports include deterministic shortest propagation paths. Cross-tenant edges are rejected. Rebuilding a revoked node requires an explicit actor and fresh evidence; descendants are not silently reinstated.

## Phase 34 — Derivation-Gated Retrieval
Added field-level lineage access checks. A derived artifact is served only if every contributing source field is authorized for the requesting tenant and classification policy. Incomplete lineage fails closed. Composition preserves parent lineage to prevent a derived summary from laundering restricted fields. Duplicate source fields retain the most restrictive classification; cross-tenant source fields are rejected.

## Phase 35 — Memory At-Rest Integrity Benchmark
Added ten attack classes: content mutation, deletion, reorder, replay, forgery, whole-store rollback, head metadata tamper, scope transplant, revoked-record backup restore, and signature stripping. The scorer distinguishes blocked-at-read, served-then-flagged, blocked-without-signal, undetected attack and false alarm. Read-time refusal earns full credit; audit-only detection earns partial credit.

## Research and prior art
- IETF Internet-Draft, *A Benchmarking Method for the Integrity of AI Agent Memory at Rest* (2 Nov 2026): https://www.ietf.org/archive/id/draft-khandelwal-bpm-agent-memory-integrity-00.html. Work in progress; defines storage-level mutation, deletion, reorder, replay, forgery, rollback and backup-restoration attacks, read-time vs audit-time detection, and machine-readable results.
- *Revoked but Still Authoritative* (arXiv:2609.08258, 8 Sep 2026): https://arxiv.org/abs/2609.08258. Evaluates revocation enforcement across five memory systems; motivates fail-closed propagation.
- *The Memory Trust Gap* (arXiv:2609.01852, 1 Sep 2026): https://arxiv.org/abs/2609.01852. Reports stale memories can be over-trusted even when authoritative tools disagree.
- *STALE* (arXiv:2605.06527): https://arxiv.org/abs/2605.06527. Studies state resolution, premise resistance and downstream policy adaptation.
- *Lineage-Aware Memory Governance* (IEEE Access, 3 Sep 2026): https://doi.org/10.1109/ACCESS.2026.3730363. Proposes derivation-gated field-level access for derived memory.
- *From Agent Traces to Trust* (survey, v6 15 Oct 2026): https://www.alphaxiv.org/abs/2606.04990v2. Frames execution provenance and evidence tracing as typed graphs.

## Reddit and GitHub ecosystem signals
- Practitioner reports describe revoked or stale facts continuing to dominate retrieval and cause actions: https://www.reddit.com/r/AI_Agents/comments/1wg41et/the_memory_trust_gap_why_your_agent_acts_on_stale/ (anecdotal, not peer-reviewed).
- GitHub knowledge-graph topic snapshot (7 Nov 2026) highlights Graphify, Understand-Anything, Hindsight and NVIDIA Auto Ontology: https://github.locker/topics/knowledge-graph. Trend counts are volatile, not a quality benchmark.
- Archived agent-memory benchmark prior art covers temporal, conflict, multi-hop, abstention and provenance: https://github.com/verifiedstate/agent-memory-eval.

## Novelty statement
Revocation, lineage access control and memory-integrity tests each have prior art. The proposed differentiation is one enforceable trust boundary coupling revocation propagation, derived-field authorization and at-rest integrity measurement with explicit read-time refusal. No world-first or patentability claim is made.
