import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const env = { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token }
const channelRow = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'manual-channel',
  display_name: 'Manual Channel',
  capability: 'C0',
  country_eligibility: [],
  policy_url: null,
  policy_checked_at: null,
  payout_requirements: {},
  capability_evidence: {},
  reviewed_at: null,
  reviewed_by: null,
  enabled: false,
  created_at: '2026-11-08T00:00:00Z',
  updated_at: '2026-11-08T00:00:00Z',
}
function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      if (sql.includes('INSERT INTO arsy_channels')) return { rows: [channelRow] }
      if (sql.includes('UPDATE arsy_channels')) return { rows: [{ ...channelRow, capability: 'C1', enabled: true }] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('channel registry is protected by the common commerce operator guard', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/channels' })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('channel creation starts at C0 and review requires explicit evidence-backed pass states', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/channels',
      headers: { 'x-arsy-operator-token': token },
      payload: { slug: 'manual-channel', displayName: 'Manual Channel' },
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.capability, 'C0')
    const invalidReview = await app.inject({
      method: 'PATCH',
      url: '/api/v1/channels/11111111-1111-4111-8111-111111111111/review',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        countryEligibility: [{ country: 'ID', status: 'pass' }],
        payoutRequirements: { status: 'pass', notes: 'Payout details were reviewed.' },
        policyStatus: 'pass',
        policyUrl: 'https://example.com/policy',
        policyCheckedAt: '2026-11-08T00:00:00Z',
        manualFallback: 'The owner manually uploads the package and records the receipt.',
      },
    })
    assert.equal(invalidReview.statusCode, 400)
    assert.equal(pool.calls.length, 1)
    const reviewed = await app.inject({
      method: 'PATCH',
      url: '/api/v1/channels/11111111-1111-4111-8111-111111111111/review',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        countryEligibility: [{ country: 'ID', status: 'pass', sourceUrl: 'https://example.com/eligibility', checkedAt: '2026-11-08T00:00:00Z' }],
        payoutRequirements: { status: 'pass', sourceUrl: 'https://example.com/payout', checkedAt: '2026-11-08T00:00:00Z', notes: 'Payout requirements were verified.' },
        policyStatus: 'pass',
        policyUrl: 'https://example.com/policy',
        policyCheckedAt: '2026-11-08T00:00:00Z',
        manualFallback: 'The owner manually uploads the package and records the receipt.',
      },
    })
    assert.equal(reviewed.statusCode, 200)
    assert.equal(reviewed.json().data.capability, 'C1')
    assert.equal(reviewed.json().data.enabled, true)
    assert.match(pool.calls[1].sql, /capability = \$2/)
  } finally { await app.close() }
})
