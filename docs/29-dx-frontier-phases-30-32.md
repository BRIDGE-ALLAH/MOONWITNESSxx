# MOONWITNESS DX Frontier — Phases 30–32

**Snapshot:** 2026-11-08  
**Branch:** \`feat/moonwitness-dx-phases-30-32\`  
**Design:** convert static coordination hints into evidence-aware release gates, without pretending local JSON is a trusted CI attestation.

## Phase 30 — Objective-Gap Control Plane
Command: \`pnpm devx objective-plane --input=.moonwitness/objectives.json\`.

An objective has acceptance criteria with stable IDs and optional owners. Observations are timestamped and state passed/failed/unknown. A criterion is satisfied only when its latest observation is explicitly verified and carries an evidence ID. The output reports completed/open objectives, gap fingerprints and next actions grouped by owner.

Limit: evidence IDs and the verified flag are supplied assertions until CI/reviewer signatures are authenticated. It does not schedule or terminate agents.

## Phase 31 — Interface Escrow
Command: \`pnpm devx interface-escrow --input=.moonwitness/escrow.json\`.

A breaking contract declares an interface set, version and expiry. The escrow computes a SHA-256 fingerprint over the change and declared provider/consumer treaties. Every affected consumer must acknowledge that exact fingerprint before the escrow is merge-ready.

Limit: this is a declaration contract, not an automatic TypeScript/OpenAPI/GraphQL/SQL schema diff. Consumer identity is not authenticated by the local CLI.

## Phase 32 — Proof-Carrying Merge Queue
Command: \`pnpm devx merge-proof --input=.moonwitness/merge-evidence.json\`.

The packet recomputes objective status, validates the interface escrow, forecasts declared resource collisions, requires four quality-gate assertions, evidence hashes and a verified rollback plan, then hashes the packet.

Limit: supplied CI status/run IDs are not authenticated against GitHub, and the digest is not a signature. This command does not merge PRs or bypass GitHub review/branch protection. A future adapter must query checks for the exact commit, validate actor identity and sign/persist the receipt.

## Research synthesis and new hypotheses
- The 2026 systematic mapping study of 94 Agentic Software Engineering papers reports that only 19.8% of evaluation records attribute evidence to an individual design decision, while 52.3% evaluate complete systems. This motivates per-gate ablations and evidence-to-decision lineage rather than merely adding more agent roles.
- PASC's 2026 ESEM shared-workspace study reports gains from peer-aware action-space coordination, while observing rising interference beyond two agents. This suggests **bounded swarm topology**: adapt team size to collision density and interface coupling rather than maximizing parallelism.
- Soei (arXiv:2610.39468, submitted 29 Oct 2026) proposes acknowledgement-aware traces, hash-chained ledgers, W3C PROV alignment and explicit separation of completion claims from proof. This overlaps strongly with our evidence packet direction; treat as prior art, not novelty.
- RCP (published 28 Aug 2026) uses SQL-backed orchestration state and a verify-before-summarize loop, another relevant prior-art signal for a persisted control plane.
- Reddit reports corroborate practical pain around shared runtime state and false progress; anecdotal reports are not controlled evidence.
- GitHub ecosystem trend: agent orchestration and proactive coding agents are growing; compare with existing orchestrators and sandboxes before implementing custom scheduling.

### Frontier hypotheses to benchmark (not world-first claims)
1. **Adaptive swarm topology:** use interface graph centrality, resource overlap and objective coupling to cap parallel agent count and choose peer-aware vs isolated execution.
2. **Evidence debt market:** every unverified claim creates measurable evidence debt with owner, expiry and downstream dependency cost; release priority is driven by debt reduction.
3. **Causal rollback selection:** select rollback/compensation based on observed dependency graph and reversible effect classes, not merely git revert.
4. **Contract migration canary:** replay consumer fixtures against old/new schemas, then graduate escrow acknowledgements into machine-generated compatibility proofs.
5. **Proof-carrying CI economics:** optimize fast test selection under a measured false-negative budget with randomized full-suite audits and per-test historical defect yield.

No claim is made that these ideas are globally unprecedented. Differentiation requires a systematic patent/paper/code prior-art review and public reproducible benchmarks.

## Acceptance metrics
- Objective false-complete rate; evidence coverage per criterion; time-to-close gap.
- Interface escrow false-block and missed-consumer rates.
- Merge packet false-ready rate; percentage of packets bound to authenticated commit checks.
- Agent throughput versus destructive collision rate as swarm size increases.
- Rollback recovery time and side-effect containment.
