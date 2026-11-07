import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'

const token = 'channel-test-operator-token'
const ownerId = 'channel-owner'
const channelId = '33333333-3333-4333-8333-333333333333'
const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }

function evidence(evidenceType, sourceName, sourceUrl) {
  return {
    evidenceType, sourceName, sourceUrl,
    capturedAt: '2026-11-08T00:00:00Z',
    reviewedAt: '2026-11-08T00:00:00Z',
    evidenceClass: 'observed-fact',
    summary: `Observed ${evidenceType} information in the official public source.`,
    limitations: 'Evidence is a captured public snapshot and may become stale.',
  }
}
const body = {
  channelKey: 'sample-channel',
  displayName: 'Sample Channel',
  countryCode: 'ID',
  accountEligibility: 'eligible',
  officialPolicyUrl: 'https://example.com/policy',
  policyReviewedAt: '2026-11-08T00:00:00Z',
  policyRecheckAt: '2027-02-08T00:00:00Z',
  payoutRequirements: { supportedCurrency: 'IDR', payoutMethod: 'bank-transfer' },
  listingRequirements: { acceptedMediaTypes: ['application/pdf'], acceptedProductFamilies: ['digital-utility'], maxAssetBytes: 10485760 },
  payoutSetupStatus: 'configured',
  capability: 'C1',
  grantedScopes: [],
  quotaNotes: {},
  channelStatus: 'active',
  evidence: [
    evidence('official-policy', 'Official channel policy', 'https://example.com/policy'),
    evidence('account-eligibility', 'Account eligibility page', 'https://example.com/account'),
    evidence('payout-requirements', 'Payout requirements', 'https://example.com/payout'),
    evidence('format-requirements', 'Format requirements', 'https://example.com/formats'),
  ],
}
function createPool() {
  const calls = []
  let channel = null
  const evidenceRows = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('INSERT INTO arsy_channels')) {
        channel = {
          id: channelId, channel_key: values[2], display_name: values[3], country_code: values[4],
          account_eligibility: values[5], official_policy_url: values[6], policy_reviewed_at: values[7],
          policy_recheck_at: values[8], payout_requirements: JSON.parse(values[9]), listing_requirements: JSON.parse(values[10]), payout_setup_status: values[11],
          capability: values[12], granted_scopes: JSON.parse(values[13]), quota_notes: JSON.parse(values[14]),
          channel_status: values[15], revision: 1, created_at: '2026-11-08T00:00:00Z',
          updated_at: '2026-11-08T00:00:00Z', created_by: values[16], updated_by: values[16],
        }
        for (const item of JSON.parse(values[17])) evidenceRows.push({
          id: item.id, channel_id: channelId, evidence_type: item.evidenceType, source_name: item.sourceName,
          source_url: item.sourceUrl, captured_at: item.capturedAt, reviewed_at: item.reviewedAt,
          evidence_class: item.evidenceClass, summary: item.summary, limitations: item.limitations,
          created_at: '2026-11-08T00:00:00Z', created_by: values[16],
        })
        return { rows: [channel] }
      }
      if (sql.includes('UPDATE arsy_channels')) return { rows: [] }
      if (sql.includes('FROM arsy_channels')) {
        return { rows: channel && channel.id === values[1] ? [channel] : channel ? [channel] : [] }
      }
      if (sql.includes('INSERT INTO arsy_channel_evidence')) {
        const row = {
          id: randomUUID(), channel_id: values[2], evidence_type: values[3], source_name: values[4],
          source_url: values[5], captured_at: values[6], reviewed_at: values[7],
          evidence_class: values[8], summary: values[9], limitations: values[10],
          created_at: '2026-11-08T00:00:00Z', created_by: values[11],
        }
        evidenceRows.push(row)
        return { rows: [row] }
      }
      if (sql.includes('FROM arsy_channel_evidence')) return { rows: evidenceRows }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('channel registry rejects anonymous access', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/channels' })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('C1 channel registration requires policy, account and payout evidence', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const invalid = await app.inject({
      method: 'POST', url: '/api/v1/channels',
      headers: { 'x-arsy-operator-token': token },
      payload: { ...body, evidence: [] },
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal(pool.calls.length, 0)

    const created = await app.inject({
      method: 'POST', url: '/api/v1/channels',
      headers: { 'x-arsy-operator-token': token },
      payload: body,
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.capability, 'C1')
    assert.equal(created.json().data.accountEligibility, 'eligible')

    const evidenceResponse = await app.inject({
      method: 'GET', url: `/api/v1/channels/${channelId}/evidence`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(evidenceResponse.statusCode, 200)
    assert.equal(evidenceResponse.json().data.length, 3)
  } finally { await app.close() }
})

test('channel capability cannot be promoted beyond C1', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/channels',
      headers: { 'x-arsy-operator-token': token },
      payload: { ...body, capability: 'C2' },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('channel optimistic updates reject stale revisions', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    await app.inject({ method: 'POST', url: '/api/v1/channels', headers: { 'x-arsy-operator-token': token }, payload: body })
    const response = await app.inject({
      method: 'PATCH', url: `/api/v1/channels/${channelId}`,
      headers: { 'x-arsy-operator-token': token },
      payload: { ...body, expectedRevision: 1 },
    })
    assert.equal(response.statusCode, 409)
  } finally { await app.close() }
})
