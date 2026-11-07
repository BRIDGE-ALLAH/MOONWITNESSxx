# Phase 12 — Decision Debt Compiler

**Status:** implemented pure domain compiler + synthetic Governance Lab presentation.  
**Route:** /governance-lab

## Goal
Turn weak decision rationale into a deterministic human-review backlog, including the downstream graph surfaces still relying on affected decisions.

## Detection rules
- Missing supporting evidence.
- Supporting evidence past its validity window or with invalid validity timestamp.
- Supporting evidence with absent/invalid provenance.
- Unresolved contradictory evidence.
- Traverse outgoing causes edges to report downstream affected nodes.

## Output
Each finding includes decision ID/label, severity, deterministic prioritization score, reason codes, support/stale/contradictory evidence IDs, and downstream node IDs.

## Safety boundary
Scores are triage priorities, not probabilities or an automated judgment. The compiler never edits decisions, resolves contradictions, or creates review approvals. A production backlog requires authorized ARSY snapshots and append-only reviewer events.

## Acceptance
- [x] Pure deterministic compiler with injected evaluation time.
- [x] Missing/stale/contradictory evidence detection.
- [x] Downstream impact traversal.
- [x] Tests cover stale support, contradiction, unsupported decision, and causal descendants.
- [ ] Production false-positive/false-negative evaluation and reviewer feedback loop.
- [ ] ARSY-backed review queue and append-only audit events.
