import type {
  ScenarioDefinition,
  ScenarioMetric,
  ScenarioResult,
  ScenarioResultMetric,
} from './types'

export class ScenarioValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScenarioValidationError'
  }
}

/**
 * Runs a deterministic what-if calculation over an immutable input snapshot.
 * This function has no side effects and cannot call external systems.
 */
export function runScenario(
  baseline: readonly ScenarioMetric[],
  scenario: ScenarioDefinition,
): ScenarioResult {
  const values = new Map<string, number>()
  const original = new Map<string, number>()
  for (const metric of baseline) {
    if (!metric.id || !Number.isFinite(metric.value) || values.has(metric.id)) {
      throw new ScenarioValidationError('Baseline metrics must have unique IDs and finite values')
    }
    values.set(metric.id, metric.value)
    original.set(metric.id, metric.value)
  }

  const operationIds = new Set<string>()
  for (const operation of scenario.operations) {
    if (!operation.id || operationIds.has(operation.id)) {
      throw new ScenarioValidationError('Scenario operation IDs must be unique and non-empty')
    }
    operationIds.add(operation.id)
    if (!Number.isFinite(operation.operand)) {
      throw new ScenarioValidationError(`Operation "${operation.id}" has a non-finite operand`)
    }
    if (!operation.rationale.trim()) {
      throw new ScenarioValidationError(`Operation "${operation.id}" needs an explicit rationale`)
    }
    const current = values.get(operation.metricId)
    if (current === undefined) {
      throw new ScenarioValidationError(`Unknown baseline metric: ${operation.metricId}`)
    }
    const next = operation.operation === 'set'
      ? operation.operand
      : operation.operation === 'add'
        ? current + operation.operand
        : current * operation.operand
    if (!Number.isFinite(next)) {
      throw new ScenarioValidationError(`Operation "${operation.id}" produced a non-finite result`)
    }
    values.set(operation.metricId, next)
  }

  const metrics: ScenarioResultMetric[] = baseline.map((metric) => {
    const before = original.get(metric.id) as number
    const after = values.get(metric.id) as number
    return { metricId: metric.id, before, after, delta: after - before }
  })

  return {
    scenarioId: scenario.id,
    basedOnSnapshotId: scenario.basedOnSnapshotId,
    mode: 'shadow-only',
    assumptions: [...scenario.assumptions],
    metrics,
  }
}
