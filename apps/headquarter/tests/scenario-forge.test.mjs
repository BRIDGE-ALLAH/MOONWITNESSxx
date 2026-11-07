import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runScenario, ScenarioValidationError } from '../src/features/scenario-forge/engine.ts'

const baseline = [
  { id: 'revenue', label: 'Revenue', value: 1000, unit: 'USD' },
  { id: 'cost', label: 'Cost', value: 400, unit: 'USD' },
]
const scenario = {
  id: 'scenario-upside',
  title: 'Upside case',
  basedOnSnapshotId: 'snapshot-001',
  assumptions: ['Demand increases by 10%', 'Costs remain flat'],
  operations: [
    { id: 'op-1', metricId: 'revenue', operation: 'multiply', operand: 1.1, rationale: 'Test a demand increase' },
    { id: 'op-2', metricId: 'cost', operation: 'set', operand: 400, rationale: 'Hold costs constant' },
  ],
}

test('scenario replay is deterministic and explicitly shadow-only', () => {
  const first = runScenario(baseline, scenario)
  const second = runScenario(baseline, scenario)
  assert.deepEqual(first, second)
  assert.equal(first.mode, 'shadow-only')
  assert.deepEqual(first.metrics[0], { metricId: 'revenue', before: 1000, after: 1100, delta: 100 })
})

test('scenario calculation never mutates the baseline or definition', () => {
  const before = structuredClone(baseline)
  runScenario(baseline, scenario)
  assert.deepEqual(baseline, before)
})

test('rejects unknown metrics, missing rationale, and non-finite outputs', () => {
  assert.throws(() => runScenario(baseline, { ...scenario, operations: [{ ...scenario.operations[0], metricId: 'ghost' }] }), ScenarioValidationError)
  assert.throws(() => runScenario(baseline, { ...scenario, operations: [{ ...scenario.operations[0], rationale: ' ' }] }), ScenarioValidationError)
  assert.throws(() => runScenario(baseline, { ...scenario, operations: [{ ...scenario.operations[0], operand: Number.MAX_VALUE, operation: 'multiply' }] }), ScenarioValidationError)
})

test('rejects empty scenario identity and unsupported operations', () => {
  assert.throws(() => runScenario(baseline, { ...scenario, id: ' ' }), ScenarioValidationError)
  assert.throws(() => runScenario(baseline, { ...scenario, operations: [{ ...scenario.operations[0], operation: 'divide' }] }), ScenarioValidationError)
})
