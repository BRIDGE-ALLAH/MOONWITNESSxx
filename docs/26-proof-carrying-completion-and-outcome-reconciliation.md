# ARSY Phases 18–20 — Verifiable Completion Loop

**Status:** framework-neutral deterministic primitives; adapter integration and production rollout remain gated.
**Research snapshot:** 2026-11-08.

## Why these phases

Practitioner discussions repeatedly describe the same operational failure: agents report success, but a human still has to verify that the artifact exists and the external side effect actually happened. A Reddit thread about 1,228 interventions describes false-done reports, hidden deterministic checks, and PASS/FAIL/UNVERIFIED as a safer contract. A separate audit-trail discussion points to per-agent identity and resource-level attribution as the missing join key. These are qualitative signals, not representative research samples.

Research on provenance and evidence ontologies supports recording the entities, activities, source spans, and derivation paths behind claims rather than relying on one opaque explanation score. A 2025 provenance platform paper also highlights that upstream transformations are part of the explanation surface, not just model behavior.

## Phase 18 — Proof-Carrying Completion

Implementation: \`packages/arsy-core/src/verification/completion.ts\`

- A versioned verification contract lists required checks.
- Each check requires an independent verifier and evidence reference by default.
- Executor self-verification is downgraded to UNVERIFIED.
- Missing or duplicate observations cannot silently pass.
- Completion is allowed only when all required checks independently return PASS.

Boundary: this is a deterministic evaluator, not a verifier runner, identity provider, signature verifier, or CI attestation service. Evidence references must be resolved and authenticated by trusted adapters.

## Phase 19 — Human Attention Router

Implementation: \`packages/arsy-core/src/review/routing.ts\`

- Deterministically orders human review items.
- Compromised upstream sources escalate to critical priority.
- Action-blocking reviews rank ahead of non-blocking items at equal severity.
- Age and stable ID provide deterministic tie-breaking.

Boundary: the router never approves/rejects decisions and never executes actions. Queue persistence, assignment, SLA policy, notification, and access control remain host responsibilities.

## Phase 20 — Continuous Outcome Reconciliation

Implementation: \`packages/arsy-core/src/reconciliation/outcome.ts\`

- Compares expected state digest with independently observed provider read-back.
- Distinguishes confirmed, drift-detected, unavailable, and stale observations.
- Missing, stale, or mismatched read-back requests reopening/reverification.
- The primitive is read-only and does not attempt compensation or retry.

Boundary: production adapters must fetch authoritative provider state, enforce tenant/principal scope, and bind observations to a specific resource/version. Compensation requires separate approval and idempotency design.

## Differentiated product hypothesis

Proof-carrying decisions with a living postcondition: every agent task carries a versioned contract, independent evidence for each required check, explicit human-attention routing for exceptions, and a post-action read-back that can reopen a previously completed decision if reality drifts.

This combines known techniques; it is not claimed to be globally unprecedented. The testable differentiator is that a self-reported "done" cannot become complete without independent proof and remains subject to later state reconciliation.

## Evaluation plan

1. Seed false-success fixtures (tool returns success but writes nothing; wrong row count; wrong artifact digest).
2. Measure verifier false-pass and false-fail rates independently from the agent under test.
3. Inject stale, replayed, missing, and cross-tenant observations.
4. Measure time-to-detect drift, review queue precision, reopen completeness, and reviewer minutes per resolved exception.
5. Run in shadow mode before enforcement; the LLM must never issue the authoritative PASS verdict.

## Prior-art references

- Chhetri et al., *Bridging the Scientific Knowledge Gap and Reproducibility: A Survey of Provenance, Assertion and Evidence Ontologies*, WWW Companion 2025. [DOI](https://doi.org/10.1145/3701716.3715483).
- Gregori et al., *An LLM-guided platform for multi-granular collection and management of data provenance*, Journal of Big Data 2025. [Open access](https://link.springer.com/article/10.1186/s40537-025-01209-3).
- [GitHub: Awesome Agent Trace & Evidence Attribution](https://github.com/aaronlyt/awesome-agent-trace-and-evidence-attribution).
- [Reddit: audited human interventions and false-done reports](https://www.reddit.com/r/AI_Agents/comments/1wrqpyk/audited_1228_human_interventions_in_our_ai_agent/).
- [Reddit: per-agent audit trail and identity attribution](https://www.reddit.com/r/CyberSecurityAdvice/comments/1wsk1lh/how_are_you_producing_peragent_audit_trails_when/).

## Release gates still open

- [ ] Bind verifier IDs to authenticated service principals and signed attestations.
- [ ] Resolve evidence references and verify digest/signature at ingestion.
- [ ] Add tenant/resource/version binding to provider read-back adapters.
- [ ] Persist review queue state and escalation history.
- [ ] Add property-based and adversarial tests, including cross-tenant replay.
- [ ] Run workspace CI and independent review before merging.
