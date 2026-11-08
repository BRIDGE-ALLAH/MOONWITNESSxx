import test from 'node:test'
import assert from 'node:assert/strict'
import { InspectionRepository } from '../src/inspections/repository.ts'

test('retired products cannot receive a new inspection or be moved back to review', async () => {
  let statement = ''
  let parameters
  const repository = new InspectionRepository({
    query: async (sql, values) => {
      statement = sql
      parameters = values
      return { rows: [] }
    },
    end: async () => undefined,
  })
  const result = await repository.record('owner-a', 'owner-a', {
    productVersionId: '11111111-1111-4111-8111-111111111111',
    inspectionType: 'technical',
    status: 'pass',
    findings: [{ severity: 'info', description: 'Terminal lifecycle guard fixture.' }],
  })
  assert.equal(result, null)
  assert.match(statement, /p\.lifecycle_state <> 'retired'/)
  assert.match(statement, /FOR UPDATE OF p/)
  assert.match(statement, /SET lifecycle_state = CASE/)
  assert.match(statement, /asset\.archived_at IS NULL/)
  assert.match(statement, /asset\.rights_state <> 'pass'/)
  assert.match(statement, /productReady/)
  assert.deepEqual(parameters.slice(1, 3), ['owner-a', 'technical'])
})
