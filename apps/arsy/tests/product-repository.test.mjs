import test from 'node:test'
import assert from 'node:assert/strict'
import { ProductRepository } from '../src/products/repository.ts'

const productRow = {
  id: '11111111-1111-4111-8111-111111111111',
  opportunity_id: '22222222-2222-4222-8222-222222222222',
  title: 'Localized inventory utility',
  product_family: 'digital-utility',
  lifecycle_state: 'brief',
  version_id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  brief: { buyerProblem: 'Stock reconciliation is hard.' },
  acceptance_criteria: ['Imports a CSV', 'Highlights low stock'],
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T00:00:00.000Z',
}

test('creates a product version only from an owner-scoped approved opportunity', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [productRow] }
    },
    end: async () => undefined,
  })
  const product = await repository.createFromOpportunity('owner-a', 'owner-a', productRow.opportunity_id, ['Imports a CSV', 'Highlights low stock'])
  assert.equal(product?.id, productRow.id)
  assert.equal(product?.version, 1)
  assert.match(call.sql, /decision = 'prototype-candidate'/)
  assert.match(call.sql, /hard_gates @>/)
  assert.match(call.sql, /product_promoted_at IS NULL/)
  assert.match(call.sql, /product_promoted_at = now\(\)/)
  assert.match(call.sql, /FROM frozen AS eligible/)
  assert.match(call.sql, /ON CONFLICT \(opportunity_id\)/)
  assert.match(call.sql, /FOR UPDATE/, 'promotion locks the opportunity against concurrent edits')
  assert.equal(call.values[0], 'owner-a')
  assert.equal(call.values[1], productRow.opportunity_id)
})

test('product reads are owner-scoped', async () => {
  let values
  const repository = new ProductRepository({
    query: async (_sql, params) => {
      values = params
      return { rows: [productRow] }
    },
    end: async () => undefined,
  })
  await repository.get('owner-a', productRow.id)
  assert.deepEqual(values, ['owner-a', productRow.id])
})

test('creates append-only product versions with expected-version locking', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [{ ...productRow, version: 2, brief: { buyerProblem: 'Updated brief' } }] }
    },
    end: async () => undefined,
  })
  const result = await repository.createVersion(
    'owner-a',
    'owner-a',
    productRow.id,
    1,
    { buyerProblem: 'Updated brief' },
    ['Imports source rows', 'Exports reconciliation report'],
  )
  assert.equal(result.conflict, false)
  assert.equal(result.product?.version, 2)
  assert.match(call.sql, /FOR UPDATE/)
  assert.match(call.sql, /INSERT INTO arsy_product_versions/)
  assert.match(call.sql, /version-created/)
  assert.deepEqual(call.values.slice(0, 3), ['owner-a', productRow.id, 1])
})

test('product lifecycle transitions are audited and owner scoped', async () => {
  let call
  const repository = new ProductRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [{ ...productRow, lifecycle_state: 'production' }] }
    },
    end: async () => undefined,
  })
  const result = await repository.transition('owner-a', 'owner-a', productRow.id, 1, 'production', 'The approved brief is ready for production work.')
  assert.equal(result.conflict, false)
  assert.equal(result.product?.lifecycleState, 'production')
  assert.match(call.sql, /lifecycle-transition/)
  assert.match(call.sql, /WHERE owner_id = \$1 AND id = \$2/)
  assert.deepEqual(call.values.slice(0, 2), ['owner-a', productRow.id])
})

test('loads version history only after owner-scoped product existence check', async () => {
  const calls = []
  const repository = new ProductRepository({
    query: async (sql, values) => {
      calls.push({ sql, values })
      return calls.length === 1
        ? { rows: [{ id: productRow.id }] }
        : { rows: [{ id: productRow.version_id, version: 1, brief: productRow.brief, acceptance_criteria: productRow.acceptance_criteria, created_at: productRow.created_at, created_by: 'owner-a' }] }
    },
    end: async () => undefined,
  })
  const history = await repository.history('owner-a', productRow.id)
  assert.equal(history?.length, 1)
  assert.equal(history?.[0].version, 1)
  assert.deepEqual(calls[0].values, ['owner-a', productRow.id])
  assert.deepEqual(calls[1].values, ['owner-a', productRow.id])
})


test('allows retirement of a previously listed product without reopening publication', async () => {
  const calls = []
  const listed = { ...productRow, lifecycle_state: 'listed' }
  const repository = new ProductRepository({
    query: async (sql, values) => {
      calls.push({ sql, values })
      return { rows: calls.length === 1 ? [listed] : [{ ...listed, lifecycle_state: 'retired' }] }
    },
    end: async () => undefined,
  })
  const result = await repository.transition('owner-a', 'owner-a', productRow.id, 1, 'retired', 'The listed product has reached end of life and must be retired.')
  assert.equal(result.conflict, false)
  assert.equal(result.product?.lifecycleState, 'retired')
  assert.match(calls[1].sql, /lifecycle-transition/)
})
