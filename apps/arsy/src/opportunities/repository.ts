import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import type { OpportunityInput, OpportunityEvaluation } from './domain.ts'

type QueryResult<T> = { rows: T[] }

export interface OpportunityRecord {
  id: string
  revision: number
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
    revision: row.revision,
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

  async decide(
    ownerId: string,
    actorId: string,
    id: string,
    decision: OpportunityEvaluation['decision'],
    rationale: string,
    expectedRevision: number,
  ): Promise<OpportunityRecord | null> {
    const result = await this.db.query(
      `WITH changed AS (
       UPDATE arsy_opportunities SET decision = $3, decision_rationale = $4,
         revision = revision + 1,
         updated_at = now(), updated_by = $5
       WHERE owner_id = $1 AND id = $2 AND revision = $6
         AND archived_at IS NULL AND product_promoted_at IS NULL
       RETURNING *
     ), audited AS (
       INSERT INTO arsy_commerce_audit_events (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
       SELECT $7, owner_id, 'opportunity', id, 'decision-changed', $5,
         jsonb_build_object('decision', decision, 'rationale', decision_rationale, 'revision', revision)
       FROM changed
     )
     SELECT ${SELECT_COLUMNS} FROM changed`,
      [ownerId, id, decision, rationale, actorId, expectedRevision, randomUUID()],
    )
    const row = rows<OpportunityRow>(result)[0]
    return row ? mapOpportunity(row) : null
  }

  async isPromoted(ownerId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT product_promoted_at IS NOT NULL AS promoted FROM arsy_opportunities WHERE owner_id = $1 AND id = $2 LIMIT 1',
      [ownerId, id],
    )
    return rows<{ promoted: boolean }>(result)[0]?.promoted === true
  }


  async update(
    ownerId: string,
    actorId: string,
    id: string,
    expectedRevision: number,
    input: OpportunityInput,
    evaluation: OpportunityEvaluation,
  ): Promise<
    | { status: 'updated'; opportunity: OpportunityRecord }
    | { status: 'not-found' }
    | { status: 'stale'; opportunity: OpportunityRecord }
    | { status: 'promoted' }
    | { status: 'conflict' }
  > {
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_opportunities
        SET title = $4,
          buyer_problem = $5,
          buyer_segment = $6,
          job_to_be_done = $7,
          product_hypothesis = $8,
          product_family = $9,
          candidate_channels = $10::jsonb,
          evidence = $11::jsonb,
          scores = $12::jsonb,
          score_details = $13::jsonb,
          hard_gates = $14::jsonb,
          hard_gate_details = $15::jsonb,
          score = $16,
          decision = $17,
          decision_rationale = NULL,
          revision = revision + 1,
          updated_at = now(),
          updated_by = $18
        WHERE owner_id = $1
          AND id = $2
          AND revision = $3
          AND archived_at IS NULL
          AND product_promoted_at IS NULL
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $19, owner_id, 'opportunity', id, 'content-updated', $18,
          jsonb_build_object(
            'previousRevision', $3,
            'revision', revision,
            'decision', decision,
            'fields', ARRAY['title', 'buyer_problem', 'buyer_segment', 'job_to_be_done',
              'product_hypothesis', 'product_family', 'candidate_channels', 'evidence',
              'scores', 'score_details', 'hard_gates', 'hard_gate_details']
          )
        FROM changed
      )
      SELECT ${SELECT_COLUMNS} FROM changed`,
      [
        ownerId,
        id,
        expectedRevision,
        input.title,
        input.buyerProblem,
        input.buyerSegment,
        input.jobToBeDone,
        input.productHypothesis,
        input.productFamily,
        JSON.stringify(input.candidateChannels),
        JSON.stringify(input.evidence),
        JSON.stringify(input.scores),
        JSON.stringify(input.scoreDetails),
        JSON.stringify(input.hardGates),
        JSON.stringify(input.hardGateDetails),
        evaluation.score,
        evaluation.decision,
        actorId,
        randomUUID(),
      ],
    );
    const updated = rows<OpportunityRow>(result)[0];
    if (updated) return { status: 'updated', opportunity: mapOpportunity(updated) };

    const existing = await this.get(ownerId, id);
    if (!existing) return { status: 'not-found' };
    if (await this.isPromoted(ownerId, id)) return { status: 'promoted' };
    if (existing.revision !== expectedRevision) return { status: 'stale', opportunity: existing };
    return { status: 'conflict' };
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
