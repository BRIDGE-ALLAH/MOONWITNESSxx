# Phase 7 — Decision Graph / WHY Engine

**Product bet:** turn MOONWITNESS from a place that records activity into a system that can explain consequential decisions over time.

## Problem to solve

Traditional audit logs answer who clicked what and when. They rarely explain what evidence was considered, which evidence contradicted the choice, which policy constrained it, and whether the rationale is still valid.

## Proposed module

**Decision Graph** is a versioned, traversable graph of decisions, evidence, policies, actors, actions, and outcomes. It creates a durable "why-chain" rather than another chronological feed.

### Signature capabilities

- WHY view: traverse decision → evidence/counter-evidence → policy → action → outcome.
- Evidence freshness: validity windows and expired evidence create visible decision debt.
- Contradiction map: preserve dissenting evidence and show what was outweighed, never silently discard it.
- Decision lineage: supersession links preserve prior decisions and explain what changed.
- Outcome calibration: compare expected rationale with observed outcome without rewriting the original snapshot.
- Provenance lens: source, capture time, version, scope, and authorization are visible at each node.

### Initial delivery

- [x] Domain model and relationship vocabulary.
- [x] Pure graph integrity/traceability assessor.
- [x] Tests for traceable/unsubstantiated decisions, provenance, expiry, confidence, and dangling references.
- [x] Read-only Headquarter Decision Graph Explorer with traceability, contradiction, stale evidence, and Decision Debt views (synthetic fixture only).
- [ ] Production graph pagination, search, and decision detail backed by ARSY contract.
- [ ] ARSY append-only decision/evidence contracts and workspace-scoped authorization.
- [ ] Search, pagination, redaction, retention, and export policy.
- [ ] Human review workflow for stale/contradictory evidence with backend audit trail.

### Non-negotiable guardrails

- A generated explanation is not evidence.
- Confidence is a heuristic, not truth.
- Client-side visibility is not authorization.
- No graph record may be fabricated from a UI click.
- All production provenance and retention are owned by ARSY.

### Acceptance gate

A decision is traceable only when it links to at least one support, contradiction, or policy constraint; every evidence node has provenance; expired evidence is surfaced; and all source access is authorized server-side.
