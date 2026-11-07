import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessDecisionGraph } from '../src/features/decision-graph/engine.ts'

const base = {
  id: 'graph-demo',
  version: 1,
  createdAt: '2026-11-08T00:00:00.000Z',
  nodes: [
    { id: 'decision-1', kind: 'decision', label: 'Choose option A', createdAt: '2026-11-08T00:00:00.000Z' },
    { id: 'evidence-1', kind: 'evidence', label: 'Verified source', createdAt: '2026-11-08T00:00:00.000Z', provenance: { sourceType: 'document', sourceRef: 'doc:123', capturedAt: '2026-11-07T00:00:00.000Z' }, confidence: 0.8 },
  ],
  edges: [{ id: 'edge-1', from: 'evidence-1', to: 'decision-1', relation: 'supports' }],
}

test('recognizes a traceable decision and stable evidence', () => {
  const result = assessDecisionGraph(base, new Date('2026-11-08T00:00:00.000Z'))
  assert.equal(result.traceableDecisions, 1)
  assert.equal(result.unsubstantiatedDecisions, 0)
  assert.equal(result.traceability, 1)
  assert.equal(result.integrityIssues.length, 0)
})

test('flags decisions without rationale and evidence with missing provenance', () => {
  const snapshot = { ...base, edges: [], nodes: [...base.nodes, { id: 'evidence-2', kind: 'evidence', label: 'Unknown source', createdAt: '2026-11-08T00:00:00.000Z' }] }
  const result = assessDecisionGraph(snapshot, new Date('2026-11-08T00:00:00.000Z'))
  assert.equal(result.unsubstantiatedDecisions, 1)
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'missing_evidence_provenance'))
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'unsubstantiated_decision'))
})

test('flags expired evidence, invalid confidence, and dangling edges', () => {
  const snapshot = {
    ...base,
    nodes: base.nodes.map((node) => node.id === 'evidence-1'
      ? { ...node, confidence: 1.2, validUntil: '2026-11-01T00:00:00.000Z' }
      : node),
    edges: [...base.edges, { id: 'edge-2', from: 'missing', to: 'decision-1', relation: 'supports' }],
  }
  const result = assessDecisionGraph(snapshot, new Date('2026-11-08T00:00:00.000Z'))
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'expired_evidence'))
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'invalid_confidence'))
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'dangling_edge'))
})

test('does not report perfect traceability when no decisions exist', () => {
  const result = assessDecisionGraph({ ...base, nodes: [], edges: [] }, new Date('2026-11-08T00:00:00.000Z'))
  assert.equal(result.traceability, 0)
})

test('fails closed on malformed evidence validity timestamps', () => {
  const snapshot = {
    ...base,
    nodes: base.nodes.map((node) => node.id === 'evidence-1' ? { ...node, validUntil: 'not-a-date' } : node),
  }
  const result = assessDecisionGraph(snapshot, new Date('2026-11-08T00:00:00.000Z'))
  assert.ok(result.integrityIssues.some((issue) => issue.code === 'expired_evidence'))
})
