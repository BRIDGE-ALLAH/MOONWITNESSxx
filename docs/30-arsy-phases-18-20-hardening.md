# ARSY Phases 18–20 — Security and Verification Hardening

**Research snapshot:** 2026-11-08  
**Status:** deterministic core hardening; production identity, key custody, persistence and runtime enforcement remain separate release gates.

## Audit findings and decisions

The existing mainline already owns the canonical Phase 18–20 roadmap: capability delegation, proof-carrying execution, and the continuous safety lab. An older PR (#49) used the same phase numbers for a different completion/review/reconciliation proposal and was 69 commits behind main. It must not be merged as a parallel definition of these phases.

This change hardens the existing mainline contracts instead of introducing duplicate phase numbering.

## Phase 18 — Provenance-bound capability delegation

- Request and grant context must be non-empty after trimming.
- Scope arrays reject malformed wildcard patterns and non-string/blank entries.
- A trusted verifier exception returns a structured deny result; it never falls through to allow.
- Existing root-to-leaf attenuation, tenant/purpose/session binding, expiry and normalized argument-hash checks remain intact.

**Boundary:** verifier identity, issuer trust, signature parsing, KMS rotation, nonce consumption and actual tool-gateway enforcement are not supplied by this pure-domain evaluator.

## Phase 19 — Proof-carrying execution

- An approval must follow a prior policy allow for the same action.
- Duplicate approvals are rejected.
- An attestation cannot be issued before the final trace event.
- The trace digest now binds the execution contract as well as the ordered events.

**Boundary:** SHA-256 is an integrity fingerprint, not a signature or external trust anchor. Effect receipts still require authenticated provider references, idempotency keys and result-digest resolution.

## Phase 20 — Continuous Agent Safety Lab

- Empty traces and malformed context are unsafe findings, not clean runs.
- Duplicate policy decisions, approvals without a prior allow and cross-tenant terminal receipts are detected.
- Empty benchmarks now report precision/recall as undefined (null) rather than misleading perfect scores.
- Duplicate scenario IDs are rejected.

**Boundary:** no benchmark-derived threshold or empirical safety claim is made. A calibrated, licensed AgentDojo/TraceProbe subset and independent adjudication remain necessary.

## Research and prior art

1. [TraceProbe (EMNLP 2026)](https://aclanthology.org/2026.emnlp-main.1233/) evaluates agent execution traces and latent rule violations, not only final outputs. This supports trace-level findings and replay-oriented safety evaluation.
2. [AgentCap (arXiv:2611.00729, 2026)](https://arxiv.org/abs/2611.00729) studies tool-boundary authorization, short-lived capabilities and attenuation-only delegation. It closely overlaps with our Phase 18 direction; no novelty claim is made.
3. [Position: AI Agents Need Authenticated Delegation (ICML 2025)](https://proceedings.mlr.press/v267/south25a.html) argues for authenticated, auditable authority delegation across agent chains.
4. [in-toto Attestation Framework v1.2](https://github.com/in-toto/attestation/blob/main/spec/README.md) separates predicate, statement, envelope and bundle; ARSY digests should not be confused with authenticated attestation envelopes.
5. [SLSA Provenance v1.2](https://slsa.dev/spec/v1.2/provenance) provides an established provenance predicate model for build artifacts.
6. [AgenTRIM (arXiv:2601.12449, 2026)](https://arxiv.org/abs/2601.12449) motivates least-privilege tool filtering and status-aware runtime checks.

## Verification plan

- Add adversarial tests for verifier outages, malformed scopes, approval ordering, contract-bound digest, tenant drift and empty benchmark semantics.
- Run ARSY governance tests, workspace typecheck/build, Repository CI and CodeQL.
- Keep runtime enforcement and signed identity integration gated until trusted adapters exist.
