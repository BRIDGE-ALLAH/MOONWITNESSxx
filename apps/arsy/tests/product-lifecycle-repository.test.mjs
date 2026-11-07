import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductRepository } from '../src/products/repository.ts'

const productId = '11111111-1111-4111-8111-111111111111'
const row = {
  id: productId,
  opportunity_id: '22222222-2222-4222-8222-222222222222',
  title: 'Inventory reconciliation utility',
  product_family: 'digital-utility',
  lifecycle_state: 'production',
  version_id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  brief: { buyerProblem: 'Inventory mismatches.' },
  acceptance_criteria: ['Imports source rows'],
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T01:00:00.000Z',
}

test('lifecycle transition is owner- and expected-state-scoped and writes an audit event atomically', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [row] }
    },
    end: async () => undefined,
  })
  const product = await repository.transitionLifecycle('owner-a', 'operator-a', productId, 'brief', 'production')
  assert.equal(product?.lifecycleState, 'production')
  assert.match(call.sql, /UPDATE arsy_products/)
  assert.match(call.sql, /owner_id = \$1 AND id = \$2 AND lifecycle_state = \$5/)
  assert.match(call.sql, /INSERT INTO arsy_commerce_audit_events/)
  assert.deepEqual(call.values.slice(0, 5), ['owner-a', productId, 'operator-a', 'production', 'brief'])
})
