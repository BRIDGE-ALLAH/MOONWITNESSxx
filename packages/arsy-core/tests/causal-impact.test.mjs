import assert from 'node:assert/strict'
import test from 'node:test'
import { computeImpactForecast } from '../src/causal/impact.ts'

test('propagates through declared dependencies and validated causes', () => {
  const result = computeImpactForecast({
    nodes: [
      { id: 'schema', kind: 'model', label: 'Schema', impactWeight: 2 },
      { id: 'api', kind: 'workflow', label: 'API', impactWeight: 4 },
      { id: 'billing', kind: 'workflow', label: 'Billing', impactWeight: 5 },
    ],
    edges: [
      { id: 'e1', sourceId: 'schema', targetId: 'api', kind: 'declared_dependency', confidence: 1, evidenceIds: ['ev1'] },
      { id: 'e2', sourceId: 'api', targetId: 'billing', kind: 'validated_cause', confidence: 0.8, evidenceIds: ['ev2'] },
      { id: 'e3', sourceId: 'schema', targetId: 'billing', kind: 'observed_sequence', confidence: 1, evidenceIds: [] },
    ],
  }, 'schema')
  assert.deepEqual(result.impacted.map((entry) => entry.node.id), ['api', 'billing'])
  assert.equal(result.impacted.find((entry) => entry.node.id === 'billing')?.confidence, 0.8)
  assert.deepEqual(result.excludedObservedSequenceEdges, ['e3'])
})

test('rejects missing nodes and invalid confidence thresholds', () => {
  assert.throws(() => computeImpactForecast({ nodes: [], edges: [] }, 'missing'), /Unknown impact node/)
  assert.throws(() => computeImpactForecast({ nodes: [{ id: 'x', kind: 'tool', label: 'x', impactWeight: 1 }], edges: [] }, 'x', 2), /minimumConfidence/)
})
