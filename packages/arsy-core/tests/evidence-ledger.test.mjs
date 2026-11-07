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
    id: 'event-1', kind: 'observation.recorded' as const, aggregateId: 'case-1',
    occurredAt: '2026-11-08T00:00:00Z', actorId: 'system', payload: { value: 1 },
  }
  const first = await ledger.append(input)
  const retry = await ledger.append(input)
  assert.equal(retry.hash, first.hash)
  await assert.rejects(
    () => ledger.append({ ...input, payload: { value: 2 } }),
    /Event id collision/,
  )
})
