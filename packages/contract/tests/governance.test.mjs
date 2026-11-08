import assert from 'node:assert/strict'
import { test } from 'node:test'
import { governanceSnapshotInputSchema } from '../src/governance.ts'

const timestamp = '2026-11-08T00:00:00.000Z'

export function validSnapshotInput() {
  return {
    label: 'Distribution decision review',
    graph: {
      id: 'graph-1',
      version: 1,
      createdAt: timestamp,
      nodes: [
        { id: 'd1', kind: 'decision', label: 'Prepare listing package', createdAt: timestamp },
        {
          id: 'e1',
          kind: 'evidence',
          label: 'Channel policy doc',
          createdAt: timestamp,
          provenance: {
            sourceType: 'document',
            sourceRef: 'https://example.com/policy',
            capturedAt: timestamp,
          },
        },
      ],
      edges: [{ id: 'edge-1', from: 'e1', to: 'd1', relation: 'supports' }],
    },
    gateInput: {
      metrics: [
        {
          id: 'm1',
          label: 'Weekly throughput',
          low: 10,
          base: 12,
          high: 15,
          unit: 'items',
          sourceQuality: 'estimated',
        },
      ],
      requiredEvidenceCount: 2,
      verifiedEvidenceCount: 1,
      staleEvidenceCount: 0,
      contradictionCount: 0,
      unresolvedAssumptionCount: 1,
    },
    scenarioBaseline: [{ id: 'm1', label: 'Weekly throughput', value: 12, unit: 'items' }],
    scenario: {
      id: 's1',
      title: 'Tooling improvement',
      basedOnSnapshotId: 'graph-1',
      assumptions: ['Rework decreases'],
      operations: [
        {
          id: 'o1',
          metricId: 'm1',
          operation: 'multiply',
          operand: 1.1,
          rationale: 'Model tooling gain',
        },
      ],
    },
  }
}

test('accepts a fully valid governance snapshot input', () => {
  const parsed = governanceSnapshotInputSchema.safeParse(validSnapshotInput())
  assert.equal(parsed.success, true)
})

test('rejects unknown fields instead of silently dropping them', () => {
  const parsed = governanceSnapshotInputSchema.safeParse({
    ...validSnapshotInput(),
    fabricatedMetric: 42,
  })
  assert.equal(parsed.success, false)
})

test('rejects duplicate decision node ids', () => {
  const input = validSnapshotInput()
  input.graph.nodes.push({ ...input.graph.nodes[0] })
  const parsed = governanceSnapshotInputSchema.safeParse(input)
  assert.equal(parsed.success, false)
  assert.ok(parsed.error.issues.some((issue) => issue.message.includes('Duplicate node id')))
})

test('rejects edges that reference missing nodes', () => {
  const input = validSnapshotInput()
  input.graph.edges[0].to = 'missing-node'
  const parsed = governanceSnapshotInputSchema.safeParse(input)
  assert.equal(parsed.success, false)
  assert.ok(parsed.error.issues.some((issue) => issue.message.includes('missing node')))
})

test('rejects scenario operations targeting unknown baseline metrics', () => {
  const input = validSnapshotInput()
  input.scenario.operations[0].metricId = 'unknown-metric'
  const parsed = governanceSnapshotInputSchema.safeParse(input)
  assert.equal(parsed.success, false)
  assert.ok(parsed.error.issues.some((issue) => issue.message.includes('unknown baseline metric')))
})

test('rejects an empty scenario baseline', () => {
  const input = validSnapshotInput()
  input.scenarioBaseline = []
  input.scenario.operations = []
  assert.equal(governanceSnapshotInputSchema.safeParse(input).success, false)
})

test('rejects negative evidence counters and non-finite metric values', () => {
  const input = validSnapshotInput()
  input.gateInput.verifiedEvidenceCount = -1
  assert.equal(governanceSnapshotInputSchema.safeParse(input).success, false)
  const numeric = validSnapshotInput()
  numeric.gateInput.metrics[0].base = Number.NaN
  assert.equal(governanceSnapshotInputSchema.safeParse(numeric).success, false)
})

test('rejects blank labels and oversized payloads', () => {
  const input = validSnapshotInput()
  input.label = '   '
  assert.equal(governanceSnapshotInputSchema.safeParse(input).success, false)
})
