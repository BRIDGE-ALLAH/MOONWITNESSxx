# Phase 13 — Uncertainty & Governance Gate

**Status:** implemented pure domain assessor + synthetic Governance Lab presentation.  
**Route:** /governance-lab

## Goal
Prevent point estimates and incomplete evidence from masquerading as certainty. Assess whether an item is blocked, needs review, or is eligible to enter a human review process.

## Input model
- Low/base/high values for each metric.
- Source quality: verified, estimated, or missing.
- Required and verified evidence counts.
- Stale evidence, unresolved contradiction, and unresolved assumption counts.
- Explicit configurable evidence coverage and uncertainty thresholds.

## Output states
- blocked: invalid/missing metric inputs, insufficient evidence, or policy-blocking stale evidence.
- review_required: unresolved contradiction/assumptions or uncertainty outside the configured review envelope.
- eligible_for_human_review: input checks pass; this is not approval.

## Safety boundary
Every state requires human approval. Thresholds in the prototype are illustrative, not calibrated policy. Units, domain-specific uncertainty, correlated inputs, and epistemic versus aleatoric uncertainty need explicit contracts before production use. ARSY must enforce permissions and persist approval/audit events.

## Acceptance
- [x] Validate finite ordered low/base/high ranges.
- [x] Assess evidence coverage and source quality.
- [x] Route stale evidence, contradiction, wide ranges, and unresolved assumptions.
- [x] Always return requiresHumanApproval: true.
- [ ] Calibrate thresholds using historical outcomes and domain owner review.
- [ ] Backend authorization, human approval workflow, and immutable audit events.
