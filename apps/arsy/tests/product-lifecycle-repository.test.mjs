import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductRepository } from '../src/products/repository.ts'

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  opportunity_id: null,
  title: 'Lifecycle test product',
  product_family: 'digital-utility',
  lifecycle_state: 'production',
  version_id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  brief: {},
  acceptance_criteria: ['A test criterion'],
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T00:00:00.000Z',
}

test('product lifecycle update is owner- and expected-state-scoped and writes an audit event', async () => {
  let captured
  const repository = new ProductRepository({
    query: async (sql, values) => {
      captured = { sql, values }
      return { rows: [row] }
    },
    end: async () => undefined,
  })
  const product = await repository.transitionLifecycle(
    'owner-a', 'owner-a', row.id, 'brief', 'production',
  )
  assert.equal(product?.lifecycleState, 'production')
  assert.deepEqual(product?.allowedNextLifecycleStates, ['review', 'retired'])
  assert.match(captured.sql, /WHERE owner_id = \$1 AND id = \$2 AND lifecycle_state = \$5/)
  assert.match(captured.sql, /lifecycle-changed/)
  assert.deepEqual(captured.values.slice(0, 5), ['owner-a', row.id, 'owner-a', 'production', 'brief'])
})

test('repository rejects inspection and publication gate bypasses before database access', async () => {
  let calls = 0
  const repository = new ProductRepository({
    query: async () => { calls += 1; return { rows: [] } },
    end: async () => undefined,
  })
  const invalidTransitions = [
    ['brief', 'ready'],
    ['review', 'ready'],
    ['ready', 'listed'],
    ['production', 'listed'],
    ['listed', 'production'],
    ['retired', 'production'],
  ]
  for (const [from, to] of invalidTransitions) {
    assert.equal(await repository.transitionLifecycle('owner-a', 'owner-a', row.id, from, to), null)
  }
  assert.equal(calls, 0)
})
