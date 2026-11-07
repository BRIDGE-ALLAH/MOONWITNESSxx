import assert from 'node:assert/strict'
import test from 'node:test'
import { createExecutionAttestation, ExecutionProofError } from '../src/attestation/proof.ts'

const contract = { id: 'exec-1', version: 'v1', actorId: 'agent-1', tenantId: 'tenant-a' }
const events = [
  { id: 'e1', sequence: 0, kind: 'policy.allowed', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:00Z' },
  { id: 'e2', sequence: 1, kind: 'effect.started', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:01Z', payloadHash: 'input-hash' },
  { id: 'e3', sequence: 2, kind: 'effect.completed', actionId: 'a1', actorId: 'agent-1', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:02Z', payloadHash: 'result-hash' },
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

test('requires approval before effect and a receipt hash for effect events', () => {
  const approvalLate = [
    { ...events[0], approvalRequired: true },
    events[1],
    { id: 'e4', sequence: 2, kind: 'approval.recorded', actionId: 'a1', actorId: 'approver', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:02Z', approved: true },
  ]
  assert.throws(() => createExecutionAttestation(contract, approvalLate, '2026-11-08T00:00:03Z'), ExecutionProofError)
  const missingReceipt = events.map((event) => ({ ...event }))
  delete missingReceipt[1].payloadHash
  assert.throws(() => createExecutionAttestation(contract, missingReceipt, '2026-11-08T00:00:03Z'), ExecutionProofError)
})

test('rejects tenant switching and actor substitution in an otherwise valid trace', () => {
  const tenantSwitch = events.map((event) => ({ ...event }))
  tenantSwitch[1].tenantId = 'tenant-b'
  assert.throws(() => createExecutionAttestation(contract, tenantSwitch, '2026-11-08T00:00:03Z'), ExecutionProofError)
  const actorSwitch = events.map((event) => ({ ...event }))
  actorSwitch[0].actorId = 'other-agent'
  assert.throws(() => createExecutionAttestation(contract, actorSwitch, '2026-11-08T00:00:03Z'), ExecutionProofError)
})


test('rejects approvals recorded before the policy allow decision', () => {
  const approvalBeforeAllow = [
    { id: 'approval', sequence: 0, kind: 'approval.recorded', actionId: 'a1', actorId: 'approver', tenantId: 'tenant-a', occurredAt: '2026-11-08T00:00:00Z', approved: true },
    { ...events[0], sequence: 1, occurredAt: '2026-11-08T00:00:01Z', approvalRequired: true },
    { ...events[1], sequence: 2, occurredAt: '2026-11-08T00:00:02Z' },
    { ...events[2], sequence: 3, occurredAt: '2026-11-08T00:00:03Z' },
  ]
  assert.throws(() => createExecutionAttestation(contract, approvalBeforeAllow, '2026-11-08T00:00:04Z'), ExecutionProofError)
})

test('attestation issuance cannot predate the final trace event', () => {
  assert.throws(() => createExecutionAttestation(contract, events, '2026-11-08T00:00:01Z'), /attestation_issued_before_trace_end/)
})

test('trace digest is bound to the execution contract identity', () => {
  const first = createExecutionAttestation(contract, events, '2026-11-08T00:00:03Z')
  const second = createExecutionAttestation({ ...contract, id: 'exec-2' }, events, '2026-11-08T00:00:03Z')
  assert.notEqual(first.traceDigest, second.traceDigest)
})