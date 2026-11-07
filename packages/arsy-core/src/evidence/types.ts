import { createHash } from 'node:crypto'

export type EvidenceEventKind =
  | 'observation.recorded'
  | 'claim.proposed'
  | 'claim.supported'
  | 'claim.contested'
  | 'claim.superseded'
  | 'decision.recorded'
  | 'action.recorded'
  | 'outcome.recorded'

export interface EvidenceEvent {
  id: string
  kind: EvidenceEventKind
  aggregateId: string
  occurredAt: string
  recordedAt: string
  actorId: string
  payload: Record<string, unknown>
  evidenceIds: string[]
  previousHash: string | null
  hash: string
}

export interface EvidenceEventInput {
  id: string
  kind: EvidenceEventKind
  aggregateId: string
  occurredAt: string
  actorId: string
  payload: Record<string, unknown>
  evidenceIds?: string[]
}

export interface EvidenceStore {
  append(event: EvidenceEvent): Promise<void>
  list(aggregateId: string): Promise<readonly EvidenceEvent[]>
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private readonly streams = new Map<string, EvidenceEvent[]>()

  async append(event: EvidenceEvent): Promise<void> {
    const stream = this.streams.get(event.aggregateId) ?? []
    const existing = stream.find((item) => item.id === event.id)
    if (existing) {
      if (existing.hash !== event.hash) throw new Error('Event id collision')
      return
    }
    const currentHead = stream.at(-1)?.hash ?? null
    if (currentHead !== event.previousHash) {
      throw new Error('Evidence stream head changed; retry append from the latest stream version')
    }
    stream.push(event)
    this.streams.set(event.aggregateId, stream)
  }

  async list(aggregateId: string): Promise<readonly EvidenceEvent[]> {
    return [...(this.streams.get(aggregateId) ?? [])]
  }
}

function canonicalJson(value: unknown): string {
  if (typeof value === 'undefined') return '"__undefined__"'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

function hashEvent(event: Omit<EvidenceEvent, 'hash'>): string {
  return createHash('sha256').update(canonicalJson(event)).digest('hex')
}

/** Append-only, per-aggregate evidence history with a tamper-evident hash chain. */
export class EvidenceLedger {
  private readonly locks = new Map<string, Promise<void>>()
  private readonly store: EvidenceStore

  constructor(store: EvidenceStore) {
    this.store = store
  }

  async append(input: EvidenceEventInput): Promise<EvidenceEvent> {
    if (!input.id.trim() || !input.aggregateId.trim() || !input.actorId.trim()) {
      throw new Error('id, aggregateId and actorId are required')
    }
    if (Number.isNaN(Date.parse(input.occurredAt))) throw new Error('occurredAt must be a valid date')

    const previousLock = this.locks.get(input.aggregateId) ?? Promise.resolve()
    let release!: () => void
    const currentLock = new Promise<void>((resolve) => { release = resolve })
    const queuedLock = previousLock.then(() => currentLock)
    this.locks.set(input.aggregateId, queuedLock)
    await previousLock

    try {
      const history = await this.store.list(input.aggregateId)
      const normalizedEvidenceIds = [...new Set(input.evidenceIds ?? [])]
      const existing = history.find((item) => item.id === input.id)
      if (existing) {
        const sameInput =
          existing.kind === input.kind &&
          existing.occurredAt === input.occurredAt &&
          existing.actorId === input.actorId &&
          canonicalJson(existing.payload) === canonicalJson(input.payload) &&
          canonicalJson(existing.evidenceIds) === canonicalJson(normalizedEvidenceIds)
        if (sameInput) return existing
        throw new Error('Event id collision')
      }

      const previous = history.at(-1) ?? null
      const base: Omit<EvidenceEvent, 'hash'> = {
        id: input.id,
        kind: input.kind,
        aggregateId: input.aggregateId,
        occurredAt: new Date(input.occurredAt).toISOString(),
        recordedAt: new Date().toISOString(),
        actorId: input.actorId,
        payload: input.payload,
        evidenceIds: normalizedEvidenceIds,
        previousHash: previous?.hash ?? null,
      }
      const event: EvidenceEvent = { ...base, hash: hashEvent(base) }
      await this.store.append(event)
      return event
    } finally {
      release()
      if (this.locks.get(input.aggregateId) === queuedLock) this.locks.delete(input.aggregateId)
    }
  }

  async verify(aggregateId: string): Promise<{ valid: boolean; eventId?: string; reason?: string }> {
    const events = await this.store.list(aggregateId)
    let previousHash: string | null = null
    for (const event of events) {
      const { hash, ...base } = event
      if (event.previousHash !== previousHash) return { valid: false, eventId: event.id, reason: 'Broken hash chain' }
      if (hashEvent(base) !== hash) return { valid: false, eventId: event.id, reason: 'Event hash mismatch' }
      previousHash = hash
    }
    return { valid: true }
  }

  async asOf(aggregateId: string, recordedAt: string): Promise<readonly EvidenceEvent[]> {
    const cutoff = Date.parse(recordedAt)
    if (Number.isNaN(cutoff)) throw new Error('recordedAt must be a valid date')
    return (await this.store.list(aggregateId)).filter((event) => Date.parse(event.recordedAt) <= cutoff)
  }
}
