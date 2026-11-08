# Decision Graph — WHY Engine

**Phase:** 7 (foundation)  
**Status:** domain contract and pure integrity assessor; no production data source or UI.

## Product thesis

Most systems preserve *what happened*. Decision Graph preserves **why a consequential choice was made**: the evidence considered, contradictions, applicable constraints, responsible actor, resulting action, and observed outcome. It is an explainability and institutional-memory layer, not another activity feed.

## Core experience

- Open a decision and traverse its evidence, counter-evidence, policies, actors, actions, and outcomes.
- See provenance and validity windows on every evidence item.
- Detect decisions without rationale, broken references, duplicate identities, expired evidence, or invalid confidence.
- Revisit a decision after an outcome and compare the original rationale with what actually happened.
- Preserve supersession: a new decision can explicitly replace an older one without erasing history.

## Differentiators

1. **Why-chain, not event log:** relationships are first-class and navigable.
2. **Evidence half-life:** evidence can expire or lose relevance; the UI must show freshness rather than presenting old proof as current truth.
3. **Contradiction is a feature:** counter-evidence is linked, not hidden to inflate confidence.
4. **Decision debt:** unsubstantiated or stale decisions become visible governance work.
5. **Outcome feedback:** observed outcomes can later calibrate confidence, without rewriting the original decision snapshot.

## Initial domain contract

- Nodes: decision, evidence, policy, actor, action, outcome.
- Relations: supports, contradicts, constrained_by, made_by, causes, supersedes.
- Every evidence node needs a source reference and capture time.
- Confidence is normalized to 0–1 and must never be treated as objective truth.
- The pure assessor lives in `engine.ts`; it does not fetch, persist, authorize, or mutate.

## Trust and safety boundaries

- Server-side ARSY remains authoritative for identity, authorization, append-only audit, retention, and source access.
- The browser must not infer actor identity or fabricate evidence provenance.
- Redact secrets and personal data from graph labels and source references.
- No AI-generated explanation may be presented as source evidence; generated interpretation must be a separate, attributed node.
- Export, retention, and cross-workspace traversal require explicit policy contracts.

## Production gates

1. ARSY decision/evidence/audit contracts and stable IDs.
2. Provenance authorization and redaction rules.
3. Append-only snapshot/version semantics and retention policy.
4. Search, graph pagination/limits, and cycle semantics for causal relations.
5. Human review workflow for contradictory or expired evidence.
6. Accessibility and large-graph interaction design.

## Verification

Run `pnpm --filter @riotworks/headquarter test`. Unit tests cover deterministic integrity findings; integration and E2E tests await ARSY contracts.
