/**
 * Scenario Forge: deterministic, read-only what-if model contracts.
 * Inputs must be explicit snapshots; this module never executes real actions.
 */
export type ScenarioMetric = {
  id: string
  label: string
  value: number
  unit?: string
}

export type ScenarioOperation = {
  id: string
  metricId: string
  operation: 'set' | 'add' | 'multiply'
  operand: number
  rationale: string
}

export type ScenarioDefinition = {
  id: string
  title: string
  basedOnSnapshotId: string
  assumptions: string[]
  operations: ScenarioOperation[]
}

export type ScenarioResultMetric = {
  metricId: string
  before: number
  after: number
  delta: number
}

export type ScenarioResult = {
  scenarioId: string
  basedOnSnapshotId: string
  mode: 'shadow-only'
  assumptions: string[]
  metrics: ScenarioResultMetric[]
}
