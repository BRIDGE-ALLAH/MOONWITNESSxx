export type WitnessEventType =
  | "observation.recorded"
  | "claim.proposed"
  | "claim.assessed"
  | "relation.asserted"
  | "decision.recorded"
  | "action.proposed"
  | "policy.evaluated"
  | "action.completed"
  | "action.failed";

export interface WitnessEventInput {
  id: string;
  type: WitnessEventType;
  actor: string;
  occurredAt: string;
  subject: string;
  payload: Readonly<Record<string, unknown>>;
  evidenceRefs?: readonly string[];
}

export interface WitnessEvent extends WitnessEventInput {
  sequence: number;
  previousHash: string;
  hash: string;
}

export interface ClaimState {
  claimId: string;
  statement: string;
  confidence: number;
  status: "proposed" | "supported" | "contested" | "rejected";
  evidenceRefs: string[];
  lastUpdatedAt: string;
}

export interface WitnessSnapshot {
  eventCount: number;
  headHash: string;
  claims: Record<string, ClaimState>;
  observations: Record<string, { observationId: string; content: unknown; actor: string; occurredAt: string }>;
  decisions: Record<string, { decisionId: string; rationale: unknown; actor: string; occurredAt: string }>;
  actions: Record<string, { actionId: string; tool: string; status: "proposed" | "allowed" | "denied" | "completed" | "failed"; actor: string; policyRef?: string; receipt?: unknown; occurredAt: string }>;
}

const GENESIS = "0".repeat(64);
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return "{" + Object.keys(obj).sort().map((key) => JSON.stringify(key) + ":" + canonical(obj[key])).join(",") + "}";
};
const digest = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function validateInput(input: WitnessEventInput): void {
  for (const [name, value] of Object.entries({ id: input.id, actor: input.actor, subject: input.subject })) {
    if (!value.trim()) throw new Error(name + " must not be empty");
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("occurredAt must be a valid ISO date");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) throw new Error("payload must be an object");
  try { canonical(input.payload); } catch { throw new Error("payload must contain JSON-compatible data"); }
  if (input.evidenceRefs?.some((ref) => !ref.trim())) throw new Error("evidenceRefs must not contain empty references");
  if (input.type === "claim.proposed" && typeof input.payload.statement !== "string") throw new Error("claim.proposed requires payload.statement");
  if (input.type === "action.proposed" && typeof input.payload.tool !== "string") throw new Error("action.proposed requires payload.tool");
  if (input.type === "policy.evaluated" && !["allowed", "denied"].includes(String(input.payload.decision))) throw new Error("policy.evaluated requires allowed or denied decision");
  if (input.type === "claim.assessed") {
    const confidence = input.payload.confidence;
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) throw new Error("confidence must be between 0 and 1");
    if (!["supported", "contested", "rejected"].includes(String(input.payload.status))) throw new Error("invalid claim assessment status");
  }
}

export class WitnessLedger {
  readonly #events: WitnessEvent[] = [];
  readonly #ids = new Set<string>();
  #appendQueue: Promise<void> = Promise.resolve();

  append(input: WitnessEventInput): Promise<WitnessEvent> {
    const operation = this.#appendQueue.then(async () => {
      validateInput(input);
      if (this.#ids.has(input.id)) throw new Error("duplicate event id: " + input.id);
      const safePayload = deepFreeze(structuredClone(input.payload));
      const body = { ...input, payload: safePayload, evidenceRefs: [...(input.evidenceRefs ?? [])], sequence: this.#events.length + 1, previousHash: this.#events.at(-1)?.hash ?? GENESIS };
      const event: WitnessEvent = Object.freeze({ ...body, hash: await digest(body) });
      this.#events.push(event);
      this.#ids.add(input.id);
      return event;
    });
    this.#appendQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  events(): readonly WitnessEvent[] {
    return this.#events.map((event) => Object.freeze({ ...event, payload: deepFreeze(structuredClone(event.payload)), evidenceRefs: Object.freeze([...event.evidenceRefs]) })) as readonly WitnessEvent[];
  }

  async verify(): Promise<{ valid: boolean; checked: number; headHash: string; errors: string[] }> {
    const errors: string[] = [];
    let previousHash = GENESIS;
    for (const [index, event] of this.#events.entries()) {
      const { hash, ...body } = event;
      if (event.sequence !== index + 1) errors.push("sequence mismatch at " + (index + 1));
      if (event.previousHash !== previousHash) errors.push("previous hash mismatch at " + (index + 1));
      if (await digest(body) !== hash) errors.push("event hash mismatch at " + (index + 1));
      previousHash = hash;
    }
    return { valid: errors.length === 0, checked: this.#events.length, headHash: previousHash, errors };
  }

  replay(): WitnessSnapshot {
    const snapshot: WitnessSnapshot = { eventCount: 0, headHash: GENESIS, claims: {}, observations: {}, decisions: {}, actions: {} };
    for (const event of this.#events) {
      snapshot.eventCount += 1;
      snapshot.headHash = event.hash;
      if (event.type === "observation.recorded") {
        snapshot.observations[event.subject] = { observationId: event.id, content: event.payload.content, actor: event.actor, occurredAt: event.occurredAt };
      } else if (event.type === "claim.proposed") {
        snapshot.claims[event.subject] = {
          claimId: event.subject,
          statement: String(event.payload.statement),
          confidence: 0.5,
          status: "proposed",
          evidenceRefs: [...(event.evidenceRefs ?? [])],
          lastUpdatedAt: event.occurredAt
        };
      } else if (event.type === "claim.assessed") {
        const claim = snapshot.claims[event.subject];
        if (!claim) throw new Error("assessment references unknown claim: " + event.subject);
        claim.confidence = Number(event.payload.confidence);
        claim.status = event.payload.status as ClaimState["status"];
        claim.evidenceRefs = [...new Set([...claim.evidenceRefs, ...(event.evidenceRefs ?? [])])];
        claim.lastUpdatedAt = event.occurredAt;
      } else if (event.type === "decision.recorded") {
        snapshot.decisions[event.subject] = { decisionId: event.id, rationale: event.payload.rationale, actor: event.actor, occurredAt: event.occurredAt };
      } else if (event.type === "action.proposed") {
        snapshot.actions[event.subject] = { actionId: event.subject, tool: String(event.payload.tool), status: "proposed", actor: event.actor, occurredAt: event.occurredAt };
      } else if (event.type === "policy.evaluated") {
        const action = snapshot.actions[event.subject];
        if (!action) throw new Error("policy evaluation references unknown action: " + event.subject);
        action.status = event.payload.decision as "allowed" | "denied";
        action.policyRef = typeof event.payload.policyRef === "string" ? event.payload.policyRef : undefined;
        action.occurredAt = event.occurredAt;
      } else if (event.type === "action.completed" || event.type === "action.failed") {
        const action = snapshot.actions[event.subject];
        if (!action) throw new Error("action result references unknown action: " + event.subject);
        if (event.type === "action.completed" && action.status !== "allowed") throw new Error("action cannot complete without an allowed policy decision: " + event.subject);
        action.status = event.type === "action.completed" ? "completed" : "failed";
        action.receipt = event.payload.receipt;
        action.occurredAt = event.occurredAt;
      }
    }
    return snapshot;
  }
}

