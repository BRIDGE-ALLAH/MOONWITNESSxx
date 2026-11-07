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
