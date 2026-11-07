import test from 'node:test'
import assert from 'node:assert/strict'
import { assessAutonomyBudget, compileIncidentRegression, planAdaptiveSwarm } from './frontier.mjs'

test('swarm planner caps parallelism and selects peer-aware pair only without hard conflicts', () => {
  const pair = planAdaptiveSwarm({ agents: [
    { id: 'api', provides: ['User.v2'], writePaths: ['apps/arsy/src'] },
    { id: 'web', consumes: ['User.v2'], writePaths: ['apps/headquarter/src'] },
  ] })
  assert.equal(pair.strategy, 'peer-aware-pair')
  assert.equal(pair.recommendedParallelism, 2)
  const conflict = planAdaptiveSwarm({ agents: [
    { id: 'a', writePaths: ['packages/core'] },
    { id: 'b', writePaths: ['packages/core/src/index.ts'] },
  ] })
  assert.equal(conflict.strategy, 'serialize-conflicting-work')
  assert.equal(conflict.recommendedParallelism, 1)
  assert.throws(() => planAdaptiveSwarm({ agents: [{ id: 'x' }, { id: 'x' }] }), /duplicate/)
})

test('autonomy budget degrades with risk and never grants merge or deploy', () => {
  const low = assessAutonomyBudget({ risk: 'low' })
  const high = assessAutonomyBudget({ risk: 'high', signals: { collisions: 2, evidenceDebt: 2 } })
  const critical = assessAutonomyBudget({ risk: 'critical' })
  assert.ok(low.score > high.score)
  assert.equal(critical.level, 'observe-only')
  assert.deepEqual(critical.capabilities, ['read'])
  assert.ok(critical.prohibitedCapabilities.includes('merge'))
  assert.ok(critical.prohibitedCapabilities.includes('deploy'))
  assert.throws(() => assessAutonomyBudget({ risk: 'unknown' }), /risk/)
})

test('incident compiler builds dependency-closed deterministic replay and fault variants', () => {
  const incident = { id: 'incident-1', selectedOperationIds: ['notify'], operations: [
    { id: 'create', action: 'write', invariants: ['record-exists'] },
    { id: 'notify', action: 'webhook', dependsOn: ['create'], invariants: ['single-delivery'] },
    { id: 'unrelated', action: 'read' },
  ] }
  const first = compileIncidentRegression({ incident, now: '2026-11-08T00:00:00Z' })
  const second = compileIncidentRegression({ incident, now: '2026-11-08T00:00:00Z' })
  assert.deepEqual(first.operations.map((item) => item.id), ['create', 'notify'])
  assert.equal(first.minimization.omittedOperationCount, 1)
  assert.ok(first.variants.some((item) => item.injection.kind === 'duplicate-delivery'))
  assert.equal(first.digest, second.digest)
  assert.throws(() => compileIncidentRegression({ incident: { id: 'bad', operations: [
    { id: 'a', action: 'write', dependsOn: ['b'] }, { id: 'b', action: 'write', dependsOn: ['a'] },
  ] } }), /cycle/)
})
