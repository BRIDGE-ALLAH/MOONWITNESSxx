import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import type { OpportunityInput, OpportunityEvaluation } from './domain.ts'

type QueryResult<T> = { rows: T[] }

export interface OpportunityRecord {
  id: string
  title: string
  buyerProblem: string
  buyerSegment: string
  jobToBeDone: string
  productHypothesis: string
  productFamily: string
  candidateChannels: string[]
  evidence: OpportunityInput['evidence']
  scores: OpportunityInput['scores']
  scoreDetails: OpportunityInput['scoreDetails']
  hardGates: OpportunityInput['hardGates']
  hardGateDetails: OpportunityInput['hardGateDetails']
  evaluation: OpportunityEvaluation
  decisionRationale: string | null
  createdAt: string
  updatedAt: string
  revision: number
}

interface OpportunityRow {
  id: string
  title: string
  buyer_problem: string
  buyer_segment: string
  job_to_be_done: string
  product_hypothesis: string
  product_family: string
  candidate_channels: string[]
  evidence: OpportunityInput['evidence']
  scores: OpportunityInput['scores']
  score_details: OpportunityInput['scoreDetails']
  hard_gates: OpportunityInput['hardGates']
  hard_gate_details: OpportunityInput['hardGateDetails']
  score: string | null
  decision: OpportunityEvaluation['decision']
  decision_rationale: string | null
  created_at: Date | string
  updated_at: Date | string
  revision: number
  request_hash?: string
}

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

const SCORE_DIMENSIONS = [
  'demandEvidence',
  'competitionGap',
  'usefulnessDifferentiation',
  'marketplaceFit',
  'productionFeasibility',
  'durability',
  'distributionReadiness',
] as const

function mapOpportunity(row: OpportunityRow): OpportunityRecord {
  return {
    id: row.id,
    title: row.title,
    buyerProblem: row.buyer_problem,
    buyerSegment: row.buyer_segment,
    jobToBeDone: row.job_to_be_done,
    productHypothesis: row.product_hypothesis,
    productFamily: row.product_family,
    candidateChannels: row.candidate_channels,
    evidence: row.evidence,
    scores: row.scores,
    scoreDetails: row.score_details,
    hardGates: row.hard_gates,
    hardGateDetails: row.hard_gate_details,
    evaluation: {
      score: row.score === null ? null : Number(row.score),
      decision: row.decision,
      blockedGates: Object.entries(row.hard_gates).filter(([, value]) => value === 'blocked').map(([key]) => key),
      unknownGates: Object.entries(row.hard_gates).filter(([, value]) => value === 'unknown').map(([key]) => key),
      missingScoreDimensions: SCORE_DIMENSIONS.filter((dimension) => row.scores[dimension] === undefined),
    },
    decisionRationale: row.decision_rationale,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    revision: row.revision,
  }
}

const SELECT_COLUMNS = `id, title, buyer_problem, buyer_segment, job_to_be_done,
  product_hypothesis, product_family, candidate_channels, evidence, scores, score_details, hard_gates, hard_gate_details,
  score::text AS score, decision, decision_rationale, created_at, updated_at, revision`

export class OpportunityRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(
    ownerId: string,
    actorId: string,
    input: OpportunityInput,
    evaluation: OpportunityEvaluation,
    idempotencyKey: string,
  ): Promise<{ opportunity: OpportunityRecord; replayed: boolean }> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const result = await this.db.query(
      `WITH created AS (
       INSERT INTO arsy_opportunities
        (id, owner_id, title, buyer_problem, buyer_segment, job_to_be_done, product_hypothesis,
         product_family, candidate_channels, evidence, scores, score_details, hard_gates, hard_gate_details,
         score, decision, idempotency_key, request_hash, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb,
         $13::jsonb, $14::jsonb, $15, $16, $17, $18, $19, $19)
       ON CONFLICT (owner_id, idempotency_key) DO NOTHING
       RETURNING *
     ), audited AS (
       INSERT INTO arsy_commerce_audit_events
         (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
       SELECT $20, owner_id, 'opportunity', id, 'created', $19,
         jsonb_build_object('decision', decision, 'score', score)
       FROM created
     )
     SELECT ${SELECT_COLUMNS} FROM created`,
      [randomUUID(), ownerId, input.title, input.buyerProblem, input.buyerSegment, input.jobToBeDone,
        input.productHypothesis, input.productFamily, JSON.stringify(input.candidateChannels),
        JSON.stringify(input.evidence), JSON.stringify(input.scores), JSON.stringify(input.scoreDetails),
        JSON.stringify(input.hardGates), JSON.stringify(input.hardGateDetails), evaluation.score,
        evaluation.decision, idempotencyKey, requestHash, actorId, randomUUID()],
    )
    const inserted = rows<OpportunityRow>(result)[0]
    if (inserted) return { opportunity: mapOpportunity(inserted), replayed: false }

    const existingResult = await this.db.query(
      `SELECT ${SELECT_COLUMNS}, request_hash FROM arsy_opportunities
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, idempotencyKey],
    )
    const existing = rows<OpportunityRow>(existingResult)[0]
    if (!existing) throw new Error('IDEMPOTENCY_RECORD_MISSING')
    if (existing.request_hash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return { opportunity: mapOpportunity(existing), replayed: true }
  }

  async list(ownerId: string, limit = 50): Promise<OpportunityRecord[]> {
    const result = await this.db.query(
      `SELECT ${SELECT_COLUMNS} FROM arsy_opportunities
       WHERE owner_id = $1 AND archived_at IS NULL
       ORDER BY updated_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<OpportunityRow>(result).map(mapOpportunity)
  }

  async get(ownerId: string, id: string): Promise<OpportunityRecord | null> {
    const result = await this.db.query(
      `SELECT ${SELECT_COLUMNS} FROM arsy_opportunities
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<OpportunityRow>(result)[0]
    return row ? mapOpportunity(row) : null
  }

  async update(
    ownerId: string,
    actorId: string,
    id: string,
    input: OpportunityInput,
    evaluation: OpportunityEvaluation,
    expectedRevision: number,
  ): Promise<{ record: OpportunityRecord | null; conflict: boolean }> {
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_opportunities SET
          title = $3, buyer_problem = $4, buyer_segment = $5, job_to_be_done = $6,
          product_hypothesis = $7, product_family = $8, candidate_channels = $9::jsonb,
          evidence = $10::jsonb, scores = $11::jsonb, score_details = $12::jsonb,
          hard_gates = $13::jsonb, hard_gate_details = $14::jsonb,
          score = $15, decision = $16, updated_at = now(), updated_by = $17,
          revision = revision + 1
        WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL AND revision = $18
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $19, owner_id, 'opportunity', id, 'content-updated', $17,
          jsonb_build_object('revision', revision, 'score', score, 'decision', decision)
        FROM changed
      )
      SELECT ${SELECT_COLUMNS} FROM changed`,
      [ownerId, id, input.title, input.buyerProblem, input.buyerSegment, input.jobToBeDone,
        input.productHypothesis, input.productFamily, JSON.stringify(input.candidateChannels),
        JSON.stringify(input.evidence), JSON.stringify(input.scores), JSON.stringify(input.scoreDetails),
        JSON.stringify(input.hardGates), JSON.stringify(input.hardGateDetails), evaluation.score,
        evaluation.decision, actorId, expectedRevision, randomUUID()],
    )
    const updated = rows<OpportunityRow>(result)[0]
    if (updated) return { record: mapOpportunity(updated), conflict: false }
    const current = await this.get(ownerId, id)
    return { record: current, conflict: Boolean(current) }
  }

  async decide(ownerId: string, actorId: string, id: string, decision: OpportunityEvaluation['decision'], rationale: string): Promise<OpportunityRecord | null> {
    const result = await this.db.query(
      `WITH changed AS (
       UPDATE arsy_opportunities SET decision = $3, decision_rationale = $4,
         updated_at = now(), updated_by = $5
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING *
     ), audited AS (
       INSERT INTO arsy_commerce_audit_events (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
       SELECT $6, owner_id, 'opportunity', id, 'decision-changed', $5,
         jsonb_build_object('decision', decision, 'rationale', decision_rationale)
       FROM changed
     )
     SELECT ${SELECT_COLUMNS} FROM changed`,
      [ownerId, id, decision, rationale, actorId, randomUUID()],
    )
    const row = rows<OpportunityRow>(result)[0]
    return row ? mapOpportunity(row) : null
  }

  async archive(ownerId: string, actorId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `WITH changed AS (
       UPDATE arsy_opportunities SET archived_at = now(), updated_at = now(), updated_by = $3
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL RETURNING *
     ), audited AS (
       INSERT INTO arsy_commerce_audit_events (id, owner_id, aggregate_type, aggregate_id, action, actor_id)
       SELECT $4, owner_id, 'opportunity', id, 'archived', $3 FROM changed
     )
     SELECT id FROM changed`,
      [ownerId, id, actorId, randomUUID()],
    )
    return rows<{ id: string }>(result).length > 0
  }
}
