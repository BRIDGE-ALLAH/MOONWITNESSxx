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
  assert.match(call.sql, /FOR UPDATE/)
  assert.ok(call.sql.includes('product_promoted_at = now()'))
  assert.match(call.sql, /FROM frozen AS eligible/)
  assert.match(call.sql, /ON CONFLICT \(opportunity_id\)/)
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
