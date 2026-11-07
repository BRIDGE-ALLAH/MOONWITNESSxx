import type { Pool } from 'pg'
import type { EvidenceEvent, EvidenceStore } from '@riotworks/arsy-core'

interface EvidenceRow {
  id: string
  kind: EvidenceEvent['kind']
  aggregate_id: string
  occurred_at: Date | string
  recorded_at: Date | string
  actor_id: string
  payload: Record<string, unknown>
  evidence_ids: string[]
  previous_hash: string | null
  event_hash: string
}

/**
 * PostgreSQL append-only adapter.
 * Requires migrations/001_arsy_evidence_events.sql to be applied by deployment System Mode.
 * The advisory transaction lock + expected previous hash prevents cross-process hash-chain forks.
 */
export class PostgresEvidenceStore implements EvidenceStore {
  private readonly pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async append(event: EvidenceEvent): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [event.aggregateId])

      const existing = await client.query<{ event_hash: string }>(
        'SELECT event_hash FROM arsy_evidence_events WHERE aggregate_id = $1 AND id = $2',
        [event.aggregateId, event.id],
      )
      if (existing.rows[0]) {
        if (existing.rows[0].event_hash !== event.hash) throw new Error('Event id collision')
        await client.query('COMMIT')
        return
      }

      const latest = await client.query<{ event_hash: string; stream_position: string }>(
        'SELECT event_hash, stream_position FROM arsy_evidence_events WHERE aggregate_id = $1 ORDER BY stream_position DESC LIMIT 1',
        [event.aggregateId],
      )
      const currentHash = latest.rows[0]?.event_hash ?? null
      if (currentHash !== event.previousHash) {
        throw new Error('Evidence stream head changed; retry append from the latest stream version')
      }
      const nextPosition = Number(latest.rows[0]?.stream_position ?? 0) + 1

      await client.query(
        `INSERT INTO arsy_evidence_events
          (aggregate_id, stream_position, id, kind, occurred_at, recorded_at, actor_id, payload, evidence_ids, previous_hash, event_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
        [
          event.aggregateId,
          nextPosition,
          event.id,
          event.kind,
          event.occurredAt,
          event.recordedAt,
          event.actorId,
          JSON.stringify(event.payload),
          JSON.stringify(event.evidenceIds),
          event.previousHash,
          event.hash,
        ],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async list(aggregateId: string): Promise<readonly EvidenceEvent[]> {
    const result = await this.pool.query<EvidenceRow>(
      `SELECT id, kind, aggregate_id, occurred_at, recorded_at, actor_id, payload, evidence_ids, previous_hash, event_hash
       FROM arsy_evidence_events WHERE aggregate_id = $1 ORDER BY stream_position ASC`,
      [aggregateId],
    )
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      aggregateId: row.aggregate_id,
      occurredAt: new Date(row.occurred_at).toISOString(),
      recordedAt: new Date(row.recorded_at).toISOString(),
      actorId: row.actor_id,
      payload: row.payload,
      evidenceIds: row.evidence_ids,
      previousHash: row.previous_hash,
      hash: row.event_hash,
    }))
  }
}
