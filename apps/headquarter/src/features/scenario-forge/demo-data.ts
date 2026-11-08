import type { ScenarioDefinition, ScenarioMetric } from './types'

/** Synthetic planning fixture; not a live snapshot or forecast. */
export const scenarioBaseline: readonly ScenarioMetric[] = [
  { id: 'throughput', label: 'Weekly throughput', value: 120, unit: 'items' },
  { id: 'cycle-time', label: 'Average cycle time', value: 5, unit: 'days' },
  { id: 'rework', label: 'Rework rate', value: 12, unit: '%' },
  { id: 'capacity', label: 'Available capacity', value: 160, unit: 'hours' },
]
export const scenarioCases: ScenarioDefinition[] = [
  { id: 'conservative', title: 'Conservative', basedOnSnapshotId: 'demo-baseline-001', assumptions: ['Demand softens by 5%', 'Capacity stays flat'], operations: [
    { id: 'c1', metricId: 'throughput', operation: 'multiply', operand: 0.95, rationale: 'Model a modest demand slowdown' },
    { id: 'c2', metricId: 'cycle-time', operation: 'multiply', operand: 1.1, rationale: 'Model a coordination delay' },
  ] },
  { id: 'expected', title: 'Expected', basedOnSnapshotId: 'demo-baseline-001', assumptions: ['One workflow bottleneck is removed', 'Capacity improves by 5%'], operations: [
    { id: 'e1', metricId: 'throughput', operation: 'multiply', operand: 1.1, rationale: 'Model a measured workflow improvement' },
    { id: 'e2', metricId: 'cycle-time', operation: 'multiply', operand: 0.9, rationale: 'Model reduced handoff time' },
    { id: 'e3', metricId: 'capacity', operation: 'multiply', operand: 1.05, rationale: 'Model a small capacity improvement' },
  ] },
  { id: 'stress', title: 'Stress test', basedOnSnapshotId: 'demo-baseline-001', assumptions: ['Unexpected rework increases', 'Capacity is reduced by 10%'], operations: [
    { id: 's1', metricId: 'rework', operation: 'multiply', operand: 1.5, rationale: 'Model a quality regression' },
    { id: 's2', metricId: 'capacity', operation: 'multiply', operand: 0.9, rationale: 'Model constrained operator availability' },
    { id: 's3', metricId: 'cycle-time', operation: 'multiply', operand: 1.2, rationale: 'Model rework-driven delay' },
  ] },
]
