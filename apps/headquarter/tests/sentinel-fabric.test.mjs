import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectBeliefDrift } from '../src/features/belief-drift/engine.ts'
import { calculateBlastRadius } from '../src/features/blast-radius/engine.ts'
import { compileEvidenceExpiryBudget } from '../src/features/evidence-expiry/engine.ts'

test('Belief Drift Sentinel detects changed claims, confidence shifts and evidence loss', () => {
  const baseline = { id: 'b1', capturedAt: '2026-11-01T00:00:00Z', beliefs: [{ id: 'x', subject: 'demand', claim: 'stable', confidence: 0.9, evidenceRefs: ['a', 'b'] }] }
  const current = { id: 'b2', capturedAt: '2026-11-08T00:00:00Z', beliefs: [{ id: 'x', subject: 'demand', claim: 'declining', confidence: 0.5, evidenceRefs: ['b'] }] }
  const report = detectBeliefDrift(baseline, current)
  assert.equal(report.valid, true)
  assert.equal(report.changedBeliefCount, 1)
  assert.ok(report.findings.some((item) => item.code === 'claim_changed'))
  assert.ok(report.findings.some((item) => item.code === 'confidence_shift'))
  assert.ok(report.findings.some((item) => item.code === 'evidence_removed'))
})

test('Belief Drift Sentinel fails closed on malformed snapshots and rejects backwards time', () => {
  const snapshot = { id: 'x', capturedAt: '2026-11-08T00:00:00Z', beliefs: [] }
  assert.equal(detectBeliefDrift(snapshot, { ...snapshot, id: 'y', capturedAt: '2026-11-07T00:00:00Z' }).valid, false)
})

test('Counterfactual Blast-Radius traverses only causal edges and terminates cycles', () => {
  const graph = { nodes: [{ id: 'a', label: 'A', criticality: 5 }, { id: 'b', label: 'B', criticality: 4 }, { id: 'c', label: 'C', criticality: 2 }], edges: [{ id: '1', from: 'a', to: 'b', relation: 'causes' }, { id: '2', from: 'b', to: 'c', relation: 'causes' }, { id: '3', from: 'c', to: 'a', relation: 'causes' }, { id: '4', from: 'a', to: 'c', relation: 'supports' }] }
  const report = calculateBlastRadius(graph, ['a'])
  assert.equal(report.valid, true)
  assert.deepEqual(report.impacted.map((item) => item.nodeId), ['b', 'c'])
  assert.equal(report.cycleDetected, true)
  assert.equal(calculateBlastRadius(graph, ['missing']).valid, false)
})

test('Evidence Expiry Budget prioritizes expired/near-expiry evidence and counts exposed decisions', () => {
  const now = new Date('2026-11-08T00:00:00Z')
  const report = compileEvidenceExpiryBudget([
    { id: 'fresh', capturedAt: '2026-11-01T00:00:00Z', validUntil: '2026-12-01T00:00:00Z', linkedDecisionIds: ['d3'] },
    { id: 'soon', capturedAt: '2026-11-01T00:00:00Z', validUntil: '2026-11-10T00:00:00Z', linkedDecisionIds: ['d1'] },
    { id: 'dead', capturedAt: '2026-10-01T00:00:00Z', validUntil: '2026-11-07T00:00:00Z', linkedDecisionIds: ['d1', 'd2'] },
  ], now)
  assert.equal(report.valid, true)
  assert.equal(report.counts.expired, 1)
  assert.equal(report.counts.critical, 1)
  assert.equal(report.exposedDecisionCount, 2)
  assert.equal(report.items[0].evidenceId, 'dead')
})

test('Evidence Expiry Budget fails closed on malformed timestamps and thresholds', () => {
  const report = compileEvidenceExpiryBudget([{ id: 'x', capturedAt: 'bad', validUntil: 'bad', linkedDecisionIds: [] }], new Date(), { warningDays: 1, criticalDays: 2 })
  assert.equal(report.valid, false)
  assert.equal(report.counts.invalid, 1)
})

test('Blast-Radius does not mistake a longer alternate DAG path for a cycle', () => {
  const graph = { nodes: [{ id: 'a', label: 'A', criticality: 5 }, { id: 'b', label: 'B', criticality: 3 }, { id: 'c', label: 'C', criticality: 2 }], edges: [{ id: '1', from: 'a', to: 'b', relation: 'causes' }, { id: '2', from: 'b', to: 'c', relation: 'causes' }, { id: '3', from: 'a', to: 'c', relation: 'causes' }] }
  assert.equal(calculateBlastRadius(graph, ['a']).cycleDetected, false)
})

test('Evidence expiring earlier today is expired, not critical', () => {
  const report = compileEvidenceExpiryBudget([{ id: 'x', capturedAt: '2026-11-01T00:00:00Z', validUntil: '2026-11-07T23:59:59Z', linkedDecisionIds: ['d1'] }], new Date('2026-11-08T00:00:00Z'))
  assert.equal(report.items[0].status, 'expired')
})
