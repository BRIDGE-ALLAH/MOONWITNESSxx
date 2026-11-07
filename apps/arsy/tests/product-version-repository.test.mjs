import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductRepository } from '../src/products/repository.ts'

const productId = '11111111-1111-4111-8111-111111111111'
const versionRow = {
  id: '33333333-3333-4333-8333-333333333333',
  version: 2,
  brief: { buyerProblem: 'Updated inventory reconciliation.' },
  acceptance_criteria: ['Imports source rows', 'Exports audit report'],
  created_at: '2026-11-08T02:00:00.000Z',
  created_by: 'operator-a',
}

test('product version creation locks the owner-scoped product, checks expected version and audits atomically', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [{
        id: productId,
        opportunity_id: null,
        title: 'Inventory reconciliation utility',
        product_family: 'digital-utility',
        lifecycle_state: 'brief',
        version_id: versionRow.id,
        version: 2,
        brief: versionRow.brief,
        acceptance_criteria: versionRow.acceptance_criteria,
        created_at: '2026-11-08T00:00:00.000Z',
        updated_at: '2026-11-08T02:00:00.000Z',
      }] }
    },
    end: async () => undefined,
  })
  const result = await repository.createVersion('owner-a', 'operator-a', productId, 1, versionRow.brief, versionRow.acceptance_criteria)
  assert.equal(result?.version, 2)
  assert.match(call.sql, /WHERE owner_id = \$1 AND id = \$2\s+FOR UPDATE/)
  assert.match(call.sql, /current_version.version = \$7/)
  assert.match(call.sql, /INSERT INTO arsy_product_versions/)
  assert.match(call.sql, /INSERT INTO arsy_commerce_audit_events/)
  assert.deepEqual(call.values.slice(0, 2), ['owner-a', productId])
  assert.equal(call.values[6], 1)
})

test('product version history is owner-scoped and ordered newest first', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [versionRow] }
    },
    end: async () => undefined,
  })
  const versions = await repository.listVersions('owner-a', productId)
  assert.deepEqual(call.values, ['owner-a', productId])
  assert.match(call.sql, /ORDER BY v.version DESC/)
  assert.equal(versions[0].version, 2)
  assert.equal(versions[0].createdBy, 'operator-a')
})
