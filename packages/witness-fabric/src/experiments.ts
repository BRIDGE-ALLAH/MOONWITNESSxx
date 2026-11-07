import type { ClaimState, WitnessEvent, WitnessSnapshot } from "./index.ts";

export interface ClaimGenomeNode {
  claimId: string;
  statement: string;
  confidence: number;
  status: ClaimState["status"];
  validFrom?: string;
  validUntil?: string;
  evidenceRefs: string[];
}
export interface ClaimGenomeEdge {
  from: string;
  to: string;
  relation: "supports" | "contradicts" | "supersedes" | "derived_from";
  eventId: string;
}
export interface ClaimGenome {
  nodes: ClaimGenomeNode[];
  edges: ClaimGenomeEdge[];
  conflicts: Array<{ claimIds: [string, string]; relation: "contradicts" }>;
}

/** Build a provenance-preserving graph. Relations never silently overwrite claim history. */
export function buildClaimGenome(events: readonly WitnessEvent[]): ClaimGenome {
  const claims = new Map<string, ClaimGenomeNode>();
  const edges: ClaimGenomeEdge[] = [];
  for (const event of events) {
    if (event.type === "claim.proposed") {
      claims.set(event.subject, {
        claimId: event.subject,
        statement: String(event.payload.statement),
        confidence: 0.5,
        status: "proposed",
        validFrom: typeof event.payload.validFrom === "string" ? event.payload.validFrom : undefined,
        validUntil: typeof event.payload.validUntil === "string" ? event.payload.validUntil : undefined,
        evidenceRefs: [...(event.evidenceRefs ?? [])]
      });
    } else if (event.type === "claim.assessed") {
      const claim = claims.get(event.subject);
      if (claim) {
        claim.confidence = Number(event.payload.confidence);
        claim.status = event.payload.status as ClaimState["status"];
        claim.evidenceRefs = [...new Set([...claim.evidenceRefs, ...(event.evidenceRefs ?? [])])];
      }
    } else if (event.type === "relation.asserted") {
      const target = event.payload.targetClaimId;
      const relation = event.payload.relation;
      if (typeof target === "string" && ["supports", "contradicts", "supersedes", "derived_from"].includes(String(relation))) {
        if (!claims.has(event.subject) || !claims.has(target)) throw new Error("claim relation references an unknown claim");
        edges.push({ from: event.subject, to: target, relation: relation as ClaimGenomeEdge["relation"], eventId: event.id });
      }
    }
  }
  const conflicts = edges.filter((edge) => edge.relation === "contradicts").map((edge) => ({
    claimIds: [edge.from, edge.to] as [string, string], relation: "contradicts" as const
  }));
  return { nodes: [...claims.values()], edges, conflicts };
}

export interface CounterfactualOptions {
  excludeEvidenceRefs?: readonly string[];
  excludeEventIds?: readonly string[];
}
export interface ClaimDelta {
  claimId: string;
  baselineConfidence: number;
  counterfactualConfidence: number | null;
  baselineStatus: ClaimState["status"];
  counterfactualStatus: ClaimState["status"] | null;
  removedEvidenceRefs: string[];
}
export interface CounterfactualReport {
  removedEvidenceRefs: string[];
  excludedEvents: number;
  baselineEventCount: number;
  counterfactualEventCount: number;
  deltas: ClaimDelta[];
  baseline: WitnessSnapshot;
  counterfactual: WitnessSnapshot;
}

/**
 * Replays a hypothetical evidence world. This is a sensitivity experiment, not a
 * causal estimate: excluded assessment events are removed, then the stream is replayed.
 */
export async function runCounterfactual(
  events: readonly WitnessEvent[],
  replay: (inputs: readonly Omit<WitnessEvent, "sequence" | "previousHash" | "hash">[]) => Promise<WitnessSnapshot>,
  options: CounterfactualOptions
): Promise<CounterfactualReport> {
  const excludedRefs = new Set(options.excludeEvidenceRefs ?? []);
  const excludedIds = new Set(options.excludeEventIds ?? []);
  const baselineInputs = events.map(({ sequence: _s, previousHash: _p, hash: _h, ...input }) => input);
  const filtered = baselineInputs.filter((event) =>
    !excludedIds.has(event.id) && !(event.evidenceRefs ?? []).some((ref) => excludedRefs.has(ref))
  );
  const [baseline, counterfactual] = await Promise.all([replay(baselineInputs), replay(filtered)]);
  const deltas = Object.values(baseline.claims).map((claim) => {
    const changed = counterfactual.claims[claim.claimId];
    return {
      claimId: claim.claimId,
      baselineConfidence: claim.confidence,
      counterfactualConfidence: changed?.confidence ?? null,
      baselineStatus: claim.status,
      counterfactualStatus: changed?.status ?? null,
      removedEvidenceRefs: claim.evidenceRefs.filter((ref) => excludedRefs.has(ref))
    };
  }).filter((delta) =>
    delta.counterfactualConfidence !== delta.baselineConfidence ||
    delta.counterfactualStatus !== delta.baselineStatus ||
    delta.counterfactualConfidence === null
  );
  return {
    removedEvidenceRefs: [...excludedRefs],
    excludedEvents: baselineInputs.length - filtered.length,
    baselineEventCount: baseline.eventCount,
    counterfactualEventCount: counterfactual.eventCount,
    deltas,
    baseline,
    counterfactual
  };
}

export interface RealityDrift {
  claimId: string;
  severity: "info" | "warning" | "critical";
  reasons: Array<"confidence_drop" | "status_regression" | "stale_evidence" | "contradiction_added" | "claim_disappeared">;
  previousConfidence: number;
  currentConfidence: number | null;
  staleEvidenceRefs: string[];
}

/** Deterministic snapshot comparison; caller supplies age policy and current time. */
export function detectRealityDrift(input: {
  previous: WitnessSnapshot;
  current: WitnessSnapshot;
  now: string;
  staleAfterMs: number;
  confidenceDropThreshold?: number;
  genome?: ClaimGenome;
}): RealityDrift[] {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs) || input.staleAfterMs < 0) throw new Error("invalid drift time policy");
  const threshold = input.confidenceDropThreshold ?? 0.2;
  if (threshold < 0 || threshold > 1) throw new Error("confidenceDropThreshold must be between 0 and 1");
  const contradicted = new Set((input.genome?.conflicts ?? []).flatMap((item) => item.claimIds));
  const results: RealityDrift[] = [];
  for (const [claimId, oldClaim] of Object.entries(input.previous.claims)) {
    const next = input.current.claims[claimId];
    const reasons: RealityDrift["reasons"] = [];
    if (!next) reasons.push("claim_disappeared");
    else {
      if (oldClaim.confidence - next.confidence >= threshold) reasons.push("confidence_drop");
      const rank = { proposed: 0, supported: 3, contested: 2, rejected: 1 };
      if (rank[next.status] < rank[oldClaim.status]) reasons.push("status_regression");
      if (contradicted.has(claimId) && !input.genome?.conflicts.some((item) => item.claimIds.includes(claimId) && input.previous.claims[item.claimIds[0]] && input.previous.claims[item.claimIds[1]])) reasons.push("contradiction_added");
      const age = nowMs - Date.parse(next.lastUpdatedAt);
      if (age >= input.staleAfterMs) reasons.push("stale_evidence");
    }
    if (reasons.length) {
      const staleEvidenceRefs = next && reasons.includes("stale_evidence") ? [...next.evidenceRefs] : [];
      results.push({
        claimId,
        severity: reasons.includes("claim_disappeared") || reasons.includes("confidence_drop") || reasons.includes("contradiction_added") ? "critical" : "warning",
        reasons,
        previousConfidence: oldClaim.confidence,
        currentConfidence: next?.confidence ?? null,
        staleEvidenceRefs
      });
    }
  }
  return results;
}
