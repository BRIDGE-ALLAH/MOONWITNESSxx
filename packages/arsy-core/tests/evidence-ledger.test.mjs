import assert from 'node:assert/strict'
import test from 'node:test'
import { EvidenceLedger, InMemoryEvidenceStore } from '../src/evidence/types.ts'

test('appends an ordered hash chain and verifies it', async () => {
  const ledger = new EvidenceLedger(new InMemoryEvidenceStore())
  const first = await ledger.append({
    id: 'event-1', kind: 'observation.recorded', aggregateId: 'case-1',
    occurredAt: '2026-11-08T00:00:00Z', actorId: 'system', payload: { value: 1 },
  })
  const second = await ledger.append({
    id: 'event-2', kind: 'claim.proposed', aggregateId: 'case-1',
    occurredAt: '2026-11-08T00:00:01+00:00', actorId: 'system', payload: { value: 2 },
  })
  assert.equal(second.previousHash, first.hash)
  assert.equal((await ledger.verify('case-1')).valid, true)
})

test('makes identical retries idempotent and rejects id collisions', async () => {
  const ledger = new EvidenceLedger(new InMemoryEvidenceStore())
  const input = {
    id: 'event-1', kind: 'observation.recorded', aggregateId: 'case-1',
    occurredAt: '2026-11-08T00:00:00Z', actorId: 'system', payload: { value: 1 },
  }
  const first = await ledger.append(input)
  const retry = await ledger.append(input)
  assert.equal(retry.hash, first.hash)
  const equivalentTimestampRetry = await ledger.append({ ...input, occurredAt: '2026-11-08T01:00:00+01:00' })
  assert.equal(equivalentTimestampRetry.hash, first.hash)
  await assert.rejects(
    () => ledger.append({ ...input, payload: { value: 2 } }),
    /Event id collision/,
  )
})

test('in-memory store rejects a stale writer that would fork the chain', async () => {
  const store = new InMemoryEvidenceStore()
  const ledger = new EvidenceLedger(store)
  const first = await ledger.append({
    id: 'event-1', kind: 'observation.recorded', aggregateId: 'case-1',
    occurredAt: '2026-11-08T00:00:00Z', actorId: 'system', payload: {},
  })
  await assert.rejects(
    () => store.append({
      ...first, id: 'stale-event', previousHash: null, hash: 'f'.repeat(64),
    }),
    /stream head changed/,
  )
})

test('append disposition reports creation and idempotent replay explicitly', async () => {
  const ledger = new EvidenceLedger(new InMemoryEvidenceStore())
  const input = {
    id: 'event-disposition-1', kind: 'observation.recorded', aggregateId: 'case-disposition',
    occurredAt: '2026-11-08T00:00:00Z', actorId: 'system', payload: { value: 1 },
  }
  const created = await ledger.appendWithDisposition(input)
  const replayed = await ledger.appendWithDisposition(input)
  assert.equal(created.disposition, 'created')
  assert.equal(replayed.disposition, 'replayed')
  assert.equal(replayed.event.hash, created.event.hash)
})
