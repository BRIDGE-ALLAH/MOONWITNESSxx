import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type {
  GovernanceSnapshotInput,
  GovernanceSnapshotRecord,
  GovernanceSnapshotSummary,
} from '@riotworks/contract'

interface SnapshotRow {
  id: string
  owner_id: string
  label: string
  graph: GovernanceSnapshotRecord['graph']
  gate_input: GovernanceSnapshotRecord['gateInput']
  scenario_baseline: GovernanceSnapshotRecord['scenarioBaseline']
  scenario: GovernanceSnapshotRecord['scenario']
  created_at: Date
  archived_at: Date | null
}

function toRecord(row: SnapshotRow): GovernanceSnapshotRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    label: row.label,
    graph: row.graph,
    gateInput: row.gate_input,
    scenarioBaseline: row.scenario_baseline,
    scenario: row.scenario,
    createdAt: row.created_at.toISOString(),
    archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
  }
}

/** Owner-scoped persistence; every query is bounded to the authenticated operator. */
export class PostgresGovernanceStore {
  private readonly pool: Pool
  private readonly ownerId: string

  constructor(pool: Pool, ownerId: string) {
    this.pool = pool
    this.ownerId = ownerId
  }

  async create(input: GovernanceSnapshotInput): Promise<GovernanceSnapshotRecord> {
    const result = await this.pool.query<SnapshotRow>(
      `INSERT INTO arsy_governance_snapshots
         (id, owner_id, label, graph, gate_input, scenario_baseline, scenario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        randomUUID(),
        this.ownerId,
        input.label,
        JSON.stringify(input.graph),
        JSON.stringify(input.gateInput),
        JSON.stringify(input.scenarioBaseline),
        JSON.stringify(input.scenario),
      ]
    )
    return toRecord(result.rows[0])
  }

  async list(): Promise<GovernanceSnapshotSummary[]> {
    const result = await this.pool.query<
      Pick<SnapshotRow, 'id' | 'label' | 'created_at' | 'archived_at'>
    >(
      `SELECT id, label, created_at, archived_at
       FROM arsy_governance_snapshots
       WHERE owner_id = $1
       ORDER BY created_at DESC, id
       LIMIT 200`,
      [this.ownerId]
    )
    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: row.created_at.toISOString(),
      archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
    }))
  }

  async get(id: string): Promise<GovernanceSnapshotRecord | null> {
    const result = await this.pool.query<SnapshotRow>(
      `SELECT * FROM arsy_governance_snapshots WHERE id = $1 AND owner_id = $2`,
      [id, this.ownerId]
    )
    return result.rows[0] ? toRecord(result.rows[0]) : null
  }

  async archive(id: string): Promise<GovernanceSnapshotRecord | null> {
    const result = await this.pool.query<SnapshotRow>(
      `UPDATE arsy_governance_snapshots
       SET archived_at = now()
       WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL
       RETURNING *`,
      [id, this.ownerId]
    )
    if (result.rows[0]) return toRecord(result.rows[0])
    return this.get(id)
  }
}
