import type { ClaimState, WitnessEvent } from "./index.ts";

export interface BitemporalQuery {
  /** When the claim is considered true in the modeled world. */
  validAt: string;
  /** What the system had observed by this historical knowledge boundary. */
  knownAt: string;
}
export interface TemporalClaim extends ClaimState {
  validFrom: string | null;
  validUntil: string | null;
  observedAt: string;
  supersededAt: string | null;
}

/**
 * Query the evidence stream along two independent clocks:
 * validAt = world-time; knownAt = system-knowledge-time.
 * Event ordering remains append order; timestamps only constrain visibility.
 */
export function queryBitemporalClaims(events: readonly WitnessEvent[], query: BitemporalQuery): TemporalClaim[] {
  const validAt = Date.parse(query.validAt);
  const knownAt = Date.parse(query.knownAt);
  if (!Number.isFinite(validAt) || !Number.isFinite(knownAt)) throw new Error("validAt and knownAt must be valid timestamps");
  const visible = events.filter((event) => Date.parse(event.occurredAt) <= knownAt);
  const claims = new Map<string, TemporalClaim>();
  for (const event of visible) {
    if (event.type === "claim.proposed") {
      const from = typeof event.payload.validFrom === "string" ? event.payload.validFrom : null;
      const until = typeof event.payload.validUntil === "string" ? event.payload.validUntil : null;
      claims.set(event.subject, {
        claimId: event.subject,
        statement: String(event.payload.statement),
        confidence: 0.5,
        status: "proposed",
        evidenceRefs: [...(event.evidenceRefs ?? [])],
        lastUpdatedAt: event.occurredAt,
        validFrom: from,
        validUntil: until,
        observedAt: event.occurredAt,
        supersededAt: null
      });
    } else if (event.type === "claim.assessed") {
      const claim = claims.get(event.subject);
      if (!claim) throw new Error("assessment references unknown claim: " + event.subject);
      claim.confidence = Number(event.payload.confidence);
      claim.status = event.payload.status as ClaimState["status"];
      claim.evidenceRefs = [...new Set([...claim.evidenceRefs, ...(event.evidenceRefs ?? [])])];
      claim.lastUpdatedAt = event.occurredAt;
      claim.observedAt = event.occurredAt;
    } else if (event.type === "relation.asserted" && event.payload.relation === "supersedes") {
      const prior = claims.get(event.payload.targetClaimId as string);
      if (prior) prior.supersededAt = event.occurredAt;
    }
  }
  return [...claims.values()].filter((claim) => {
    const from = claim.validFrom === null ? Number.NEGATIVE_INFINITY : Date.parse(claim.validFrom);
    const until = claim.validUntil === null ? Number.POSITIVE_INFINITY : Date.parse(claim.validUntil);
    const superseded = claim.supersededAt === null ? Number.POSITIVE_INFINITY : Date.parse(claim.supersededAt);
    return from <= validAt && validAt < until && validAt < superseded;
  }).sort((a, b) => a.claimId.localeCompare(b.claimId));
}
