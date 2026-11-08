import type { DecisionGraphSnapshot } from './types'

/** Synthetic fixture only; never use as a live ARSY response. */
export const decisionGraphDemo: DecisionGraphSnapshot = {
  id: 'mw-demo-decision-graph-001', version: 1, createdAt: '2026-11-08T00:00:00.000Z',
  nodes: [
    { id: 'decision-01', kind: 'decision', label: 'Prioritize launch readiness', createdAt: '2026-11-06T09:00:00.000Z' },
    { id: 'evidence-01', kind: 'evidence', label: 'Quality gate completion report', createdAt: '2026-11-06T08:00:00.000Z', provenance: { sourceType: 'document', sourceRef: 'demo:quality-report-v1', capturedAt: '2026-11-06T08:00:00.000Z' }, confidence: 0.92, validUntil: '2026-12-01T00:00:00.000Z' },
    { id: 'evidence-02', kind: 'evidence', label: 'Previous capacity estimate', createdAt: '2026-10-01T08:00:00.000Z', provenance: { sourceType: 'document', sourceRef: 'demo:capacity-estimate-v0', capturedAt: '2026-10-01T08:00:00.000Z' }, confidence: 0.61, validUntil: '2026-10-31T00:00:00.000Z' },
    { id: 'policy-01', kind: 'policy', label: 'No production promotion without verified controls', createdAt: '2026-11-01T08:00:00.000Z' },
    { id: 'actor-01', kind: 'actor', label: 'Human operator', createdAt: '2026-11-06T09:00:00.000Z' },
    { id: 'action-01', kind: 'action', label: 'Keep rollout in gated state', createdAt: '2026-11-06T09:05:00.000Z' },
    { id: 'outcome-01', kind: 'outcome', label: 'Release risk remains visible', createdAt: '2026-11-06T09:10:00.000Z' },
  ],
  edges: [
    { id: 'edge-01', from: 'evidence-01', to: 'decision-01', relation: 'supports' },
    { id: 'edge-02', from: 'evidence-02', to: 'decision-01', relation: 'contradicts' },
    { id: 'edge-03', from: 'policy-01', to: 'decision-01', relation: 'constrained_by' },
    { id: 'edge-04', from: 'actor-01', to: 'decision-01', relation: 'made_by' },
    { id: 'edge-05', from: 'decision-01', to: 'action-01', relation: 'causes' },
    { id: 'edge-06', from: 'action-01', to: 'outcome-01', relation: 'causes' },
  ],
}
