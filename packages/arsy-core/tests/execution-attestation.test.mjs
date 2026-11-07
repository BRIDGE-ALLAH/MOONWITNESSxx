import assert from 'node:assert/strict'
import test from 'node:test'
import { createExecutionAttestation, ExecutionProofError } from '../src/attestation/proof.ts'

const contract = { id: 'exec-1', version: 'v1', actorId: 'agent-1', tenantId: 'tenant-a' }
const events = [
  { id: 'e1', sequence: 0, kind: 'policy.allowed', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:00Z' },
  { id: 'e2', sequence: 1, kind: 'effect.started', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:01Z' },
  { id: 'e3', sequence: 2, kind: 'effect.completed', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:02Z' },
]

test('attests a policy-authorized completed trace', () => {
  const result = createExecutionAttestation(contract, events, '2026-11-08T00:00:03Z')
  assert.equal(result.assurance, 'trace-consistent')
  assert.equal(result.eventCount, 3)
  assert.equal(result.traceDigest.length, 64)
})

test('refuses to attest an effect without prior authorization', () => {
  assert.throws(() => createExecutionAttestation(contract, [events[1]], '2026-11-08T00:00:03Z'), ExecutionProofError)
})
