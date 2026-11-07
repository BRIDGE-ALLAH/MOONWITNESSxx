import test from 'node:test'
import assert from 'node:assert/strict'
import { ListingRepository } from '../src/listings/repository.ts'

test('manual listing creation and publication receipt require current inspections and cleared active assets', async () => {
  const calls = []
  const repository = new ListingRepository({
    query: async (sql, values) => {
      calls.push({ sql, values })
      return { rows: [] }
    },
    end: async () => undefined,
  })
  const input = {
    productVersionId: '22222222-2222-4222-8222-222222222222',
    channelId: '33333333-3333-4333-8333-333333333333',
    title: 'Test listing package',
    description: 'A manual package fixture used to validate listing eligibility constraints.',
    tags: ['test'],
    priceMinor: '1000',
    currency: 'IDR',
    disclosures: ['Test fixture only.'],
    manualUploadInstructions: 'Do not publish. This package is only used by a repository unit test.',
  }

  assert.equal(await repository.create('owner-a', 'owner-a', input), null)
  assert.match(calls[0].sql, /asset\.archived_at IS NULL/)
  assert.match(calls[0].sql, /asset\.rights_state <> 'pass'/)
  assert.match(calls[0].sql, /FROM arsy_inspections/)
  assert.match(calls[0].sql, /latest_inspections/)
  assert.match(calls[0].sql, /FOR UPDATE OF p/)

  assert.equal(await repository.recordPublication(
    'owner-a',
    'owner-a',
    '44444444-4444-4444-8444-444444444444',
    'test-provider-reference',
    'https://example.com/test-receipt',
    '2026-11-08T00:00:00.000Z',
  ), null)
  assert.match(calls[1].sql, /asset\.archived_at IS NULL/)
  assert.match(calls[1].sql, /asset\.rights_state <> 'pass'/)
  assert.match(calls[1].sql, /FROM arsy_inspections/)
  assert.match(calls[1].sql, /latest_inspections/)
})
