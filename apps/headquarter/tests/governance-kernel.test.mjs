import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decisionGraphDemo } from '../src/features/decision-graph/demo-data.ts'
import { compileDecisionDebt } from '../src/features/decision-debt/engine.ts'
import { createReplayCapsule, verifyReplayCapsule } from '../src/features/replay-capsule/engine.ts'
import { scenarioBaseline, scenarioCases } from '../src/features/scenario-forge/demo-data.ts'
import { runScenario } from '../src/features/scenario-forge/engine.ts'
import { assessGovernanceReadiness } from '../src/features/uncertainty-gate/engine.ts'

test('Replay Capsule is content-addressed and verifies deterministic recomputation', async () => {
  const scenario = scenarioCases[1]
  const result = runScenario(scenarioBaseline, scenario)
  const capsule = await createReplayCapsule(scenarioBaseline, scenario, result)
  const verification = await verifyReplayCapsule(capsule)
  assert.equal(verification.valid, true)
  assert.equal(verification.digestMatches, true)
  assert.equal(verification.resultMatches, true)
  assert.equal(capsule.digest.length, 64)
})

test('Replay Capsule rejects tampered payload and mismatched supplied result', async () => {
  const scenario = scenarioCases[0]
  const capsule = await createReplayCapsule(scenarioBaseline, scenario)
  const tampered = { ...capsule, payload: { ...capsule.payload, scenario: { ...capsule.payload.scenario, title: 'tampered' } } }
  assert.equal((await verifyReplayCapsule(tampered)).valid, false)
  await assert.rejects(() => createReplayCapsule(scenarioBaseline, scenario, { ...capsule.payload.result, scenarioId: 'wrong' }))
})

test('Decision Debt compiler detects stale support, contradictions, and downstream impact', () => {
  const report = compileDecisionDebt({ snapshot: decisionGraphDemo, now: new Date('2026-11-08T00:00:00.000Z') })
  assert.equal(report.findings.length, 1)
  assert.ok(report.findings[0].reasons.includes('stale_support'))
  assert.ok(report.findings[0].reasons.includes('unresolved_contradiction'))
  assert.deepEqual(report.findings[0].downstreamNodeIds, ['action-01', 'outcome-01'])
  assert.ok(report.totalDebt > 0)
})

test('Decision Debt compiler flags unsupported decisions without inventing graph edges', () => {
  const snapshot = { ...decisionGraphDemo, edges: decisionGraphDemo.edges.filter((edge) => edge.to !== 'decision-01' || edge.relation !== 'supports') }
  const report = compileDecisionDebt({ snapshot, now: new Date('2026-11-08T00:00:00.000Z') })
  assert.ok(report.findings[0].reasons.includes('missing_support'))
})

test('Governance gate blocks missing sources and requires human approval in every state', () => {
  const blocked = assessGovernanceReadiness({
    metrics: [{ id: 'x', label: 'Missing', low: 0, base: 1, high: 2, sourceQuality: 'missing' }],
    requiredEvidenceCount: 10, verifiedEvidenceCount: 1, staleEvidenceCount: 0,
    contradictionCount: 0, unresolvedAssumptionCount: 0,
  })
  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.requiresHumanApproval, true)
})

test('Governance gate routes stale and contradictory evidence to review, never auto-approval', () => {
  const review = assessGovernanceReadiness({
    metrics: [{ id: 'x', label: 'Measured', low: 9, base: 10, high: 11, sourceQuality: 'verified' }],
    requiredEvidenceCount: 4, verifiedEvidenceCount: 4, staleEvidenceCount: 1,
    contradictionCount: 1, unresolvedAssumptionCount: 0,
  })
  assert.equal(review.status, 'blocked')
  assert.equal(review.requiresHumanApproval, true)
})

test('Governance gate permits human review only when inputs satisfy configured thresholds', () => {
  const ready = assessGovernanceReadiness({
    metrics: [{ id: 'x', label: 'Measured', low: 9, base: 10, high: 11, sourceQuality: 'verified' }],
    requiredEvidenceCount: 4, verifiedEvidenceCount: 4, staleEvidenceCount: 0,
    contradictionCount: 0, unresolvedAssumptionCount: 0,
  })
  assert.equal(ready.status, 'eligible_for_human_review')
  assert.equal(ready.requiresHumanApproval, true)
})
