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
  hardGates: OpportunityInput['hardGates']
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
  hard_gates: OpportunityInput['hardGates']
  score: string | null
  decision: OpportunityEvaluation['decision']
  decision_rationale: string | null
  created_at: Date | string
  updated_at: Date | string
}

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

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
    hardGates: row.hard_gates,
    evaluation: {
      score: row.score === null ? null : Number(row.score),
      decision: row.decision,
      blockedGates: Object.entries(row.hard_gates).filter(([, value]) => value === 'blocked').map(([key]) => key),
      unknownGates: Object.entries(row.hard_gates).filter(([, value]) => value === 'unknown').map(([key]) => key),
      missingScoreDimensions: [],
    },
    decisionRationale: row.decision_rationale,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

const SELECT_COLUMNS = `id, title, buyer_problem, buyer_segment, job_to_be_done,
  product_hypothesis, product_family, candidate_channels, evidence, scores, hard_gates,
  score::text AS score, decision, decision_rationale, created_at, updated_at`

export class OpportunityRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: OpportunityInput, evaluation: OpportunityEvaluation): Promise<OpportunityRecord> {
    const result = await this.db.query(
      `INSERT INTO arsy_opportunities
        (id, owner_id, title, buyer_problem, buyer_segment, job_to_be_done, product_hypothesis,
         product_family, candidate_channels, evidence, scores, hard_gates, score, decision,
         created_by, updated_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
         $11::jsonb, $12, $13, $14, $14)
       RETURNING ${SELECT_COLUMNS}`,
      [ownerId, input.title, input.buyerProblem, input.buyerSegment, input.jobToBeDone,
        input.productHypothesis, input.productFamily, JSON.stringify(input.candidateChannels),
        JSON.stringify(input.evidence), JSON.stringify(input.scores), JSON.stringify(input.hardGates),
        evaluation.score, evaluation.decision, actorId],
    )
    return mapOpportunity(rows<OpportunityRow>(result)[0])
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

  async decide(ownerId: string, actorId: string, id: string, decision: OpportunityEvaluation['decision'], rationale: string): Promise<OpportunityRecord | null> {
    const result = await this.db.query(
      `UPDATE arsy_opportunities SET decision = $3, decision_rationale = $4,
       updated_at = now(), updated_by = $5
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [ownerId, id, decision, rationale, actorId],
    )
    const row = rows<OpportunityRow>(result)[0]
    return row ? mapOpportunity(row) : null
  }

  async archive(ownerId: string, actorId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE arsy_opportunities SET archived_at = now(), updated_at = now(), updated_by = $3
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL RETURNING id`,
      [ownerId, id, actorId],
    )
    return rows<{ id: string }>(result).length > 0
  }
}
