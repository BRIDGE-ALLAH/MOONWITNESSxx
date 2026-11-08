import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductRepository } from '../src/products/repository.ts'

const productId = '11111111-1111-4111-8111-111111111111'
const brief = { buyerProblem: 'Inventory reconciliation is difficult.' }
const criteria = ['Imports source rows without loss', 'Exports a reconciliation report']
const productRow = {
  id: productId,
  opportunity_id: null,
  title: 'Inventory reconciliation utility',
  product_family: 'digital-utility',
  lifecycle_state: 'production',
  version_id: '44444444-4444-4444-8444-444444444444',
  version: 2,
  brief,
  acceptance_criteria: criteria,
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T01:00:00.000Z',
}

test('product version creation locks the owner-scoped product, checks expected version and audits atomically', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [productRow] }
    },
    end: async () => undefined,
  })
  const result = await repository.createVersion('owner-a', 'operator-a', productId, 1, brief, criteria)
  assert.equal(result?.version, 2)
  assert.match(call.sql, /WHERE owner_id = \$1 AND id = \$2\s+FOR UPDATE/)
  assert.match(call.sql, /current_version.version = \$3/)
  assert.match(call.sql, /lifecycle_state IN \('brief', 'production', 'review', 'ready'\)/)
  assert.match(call.sql, /INSERT INTO arsy_product_versions/)
  assert.match(call.sql, /INSERT INTO arsy_commerce_audit_events/)
  assert.deepEqual(call.values.slice(0, 3), ['owner-a', productId, 1])
})

test('product version history is owner-scoped and ordered newest first', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [{
        id: '55555555-5555-4555-8555-555555555555',
        version: 2,
        brief,
        acceptance_criteria: criteria,
        created_at: '2026-11-08T01:00:00.000Z',
        created_by: 'operator-a',
      }] }
    },
    end: async () => undefined,
  })
  const versions = await repository.listVersions('owner-a', productId)
  assert.deepEqual(call.values, ['owner-a', productId])
  assert.match(call.sql, /WHERE p.owner_id = \$1 AND p.id = \$2/)
  assert.match(call.sql, /ORDER BY v.version DESC/)
  assert.equal(versions[0].version, 2)
  assert.equal(versions[0].createdBy, 'operator-a')
})
