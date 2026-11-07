import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessDecisionGraph } from '../src/features/decision-graph/engine.ts'
import { decisionGraphDemo } from '../src/features/decision-graph/demo-data.ts'
import { runScenario } from '../src/features/scenario-forge/engine.ts'
import { scenarioBaseline, scenarioCases } from '../src/features/scenario-forge/demo-data.ts'

test('Decision Graph demo exposes support, contradiction, policy, and stale evidence', () => {
  const assessment = assessDecisionGraph(decisionGraphDemo, new Date('2026-11-08T00:00:00.000Z'))
  assert.equal(assessment.traceableDecisions, 1)
  assert.ok(decisionGraphDemo.edges.some((edge) => edge.relation === 'contradicts'))
  assert.equal(assessment.expiredEvidence, 1)
})

test('Scenario Arena fixtures replay deterministically and remain shadow-only', () => {
  for (const scenario of scenarioCases) {
    const first = runScenario(scenarioBaseline, scenario)
    const second = runScenario(scenarioBaseline, scenario)
    assert.deepEqual(first, second)
    assert.equal(first.mode, 'shadow-only')
    assert.equal(first.metrics.length, scenarioBaseline.length)
  }
})
