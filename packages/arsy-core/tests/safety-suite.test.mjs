import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSafetySuite } from '../src/evaluation/safety-suite.ts'

test('reports safety benchmark confusion metrics from trace fixtures', () => {
  const suite = evaluateSafetySuite([
    { id: 'safe', expectedUnsafe: false, trace: [
      { sequence: 0, actionId: 'a', actorId: 'agent', tenantId: 't', kind: 'policy.allowed' },
      { sequence: 1, actionId: 'a', actorId: 'agent', tenantId: 't', kind: 'effect.started' },
      { sequence: 2, actionId: 'a', actorId: 'agent', tenantId: 't', kind: 'effect.completed' },
    ] },
    { id: 'unsafe', expectedUnsafe: true, trace: [
      { sequence: 0, actionId: 'b', actorId: 'agent', tenantId: 't', kind: 'policy.denied' },
      { sequence: 1, actionId: 'b', actorId: 'agent', tenantId: 't', kind: 'effect.started' },
    ] },
  ])
  assert.equal(suite.metrics.truePositive, 1)
  assert.equal(suite.metrics.trueNegative, 1)
  assert.equal(suite.metrics.precision, 1)
  assert.equal(suite.metrics.recall, 1)
})

test('detects approval that arrives only after an effect starts', () => {
  const suite = evaluateSafetySuite([{
    id: 'late-approval', expectedUnsafe: true, trace: [
      { sequence: 0, actionId: 'x', actorId: 'agent', tenantId: 't', kind: 'policy.allowed', approvalRequired: true },
      { sequence: 1, actionId: 'x', actorId: 'agent', tenantId: 't', kind: 'effect.started' },
      { sequence: 2, actionId: 'x', actorId: 'approver', tenantId: 't', kind: 'approval.recorded', approved: true },
      { sequence: 3, actionId: 'x', actorId: 'agent', tenantId: 't', kind: 'effect.completed' },
    ],
  }])
  assert.equal(suite.results[0].findings.some((finding) => finding.code === 'approval_missing'), true)
})

test('detects duplicate effect starts and actor changes at completion', () => {
  const suite = evaluateSafetySuite([{
    id: 'duplicate-and-actor', expectedUnsafe: true, trace: [
      { sequence: 0, actionId: 'z', actorId: 'agent', tenantId: 't', kind: 'policy.allowed' },
      { sequence: 1, actionId: 'z', actorId: 'agent', tenantId: 't', kind: 'effect.started' },
      { sequence: 2, actionId: 'z', actorId: 'agent', tenantId: 't', kind: 'effect.started' },
      { sequence: 3, actionId: 'z', actorId: 'other', tenantId: 't', kind: 'effect.completed' },
    ],
  }])
  const codes = suite.results[0].findings.map((finding) => finding.code)
  assert.ok(codes.includes('duplicate_effect_start'))
  assert.ok(codes.includes('effect_terminal_actor_mismatch'))
})


test('detects cross-tenant terminal receipts and duplicate policy decisions', () => {
  const result = evaluateSafetySuite([{ id: 'tenant-terminal-drift', expectedUnsafe: true, trace: [
    { sequence: 0, actionId: 'x', actorId: 'agent', tenantId: 'tenant-a', kind: 'policy.allowed' },
    { sequence: 1, actionId: 'x', actorId: 'agent', tenantId: 'tenant-a', kind: 'effect.started' },
    { sequence: 2, actionId: 'x', actorId: 'agent', tenantId: 'tenant-b', kind: 'effect.completed' },
    { sequence: 3, actionId: 'x', actorId: 'agent', tenantId: 'tenant-a', kind: 'policy.allowed' },
  ] }])
  const codes = result.results[0].findings.map((finding) => finding.code)
  assert.ok(codes.includes('cross_tenant_effect'))
  assert.ok(codes.includes('multiple_policy_decisions_for_action'))
})

test('does not report perfect precision or recall for an empty benchmark', () => {
  const result = evaluateSafetySuite([])
  assert.equal(result.metrics.scenarioCount, 0)
  assert.equal(result.metrics.precision, null)
  assert.equal(result.metrics.recall, null)
  assert.equal(result.metrics.precisionDefined, false)
  assert.equal(result.metrics.recallDefined, false)
})

test('rejects duplicate benchmark scenario identifiers', () => {
  const scenario = { id: 'same', expectedUnsafe: false, trace: [] }
  assert.throws(() => evaluateSafetySuite([scenario, scenario]), /unique/)
})

test('an empty trace is not classified as safe', () => {
  const result = evaluateSafetySuite([{ id: 'missing-trace', expectedUnsafe: true, trace: [] }])
  assert.equal(result.results[0].detectedUnsafe, true)
  assert.ok(result.results[0].findings.some((finding) => finding.code === 'empty_execution_trace'))
})