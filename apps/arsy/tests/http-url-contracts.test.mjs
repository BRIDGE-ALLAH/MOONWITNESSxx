import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { httpUrlSchema } from '../src/http-url.ts'

const token = 'test-only-http-url-contract-token'
const ownerId = 'http-url-contract-test'
const headers = { 'x-arsy-operator-token': token }
const productVersionId = '11111111-1111-4111-8111-111111111111'
const recordId = '22222222-2222-4222-8222-222222222222'

function createPool() {
  let queryCount = 0
  return { query: async () => { queryCount += 1; return { rows: [] } }, end: async () => undefined, get queryCount() { return queryCount } }
}

const opportunity = {
  title: 'Evidence URL security test', buyerProblem: 'Operators need trustworthy evidence links for product decisions.',
  buyerSegment: 'Independent digital product operators', jobToBeDone: 'Review provenance and verify evidence before product promotion.',
  productHypothesis: 'A small utility that records evidence with validated source links.', productFamily: 'digital-utility', candidateChannels: [],
  evidence: [{ evidenceId: 'evidence-1', sourceName: 'Test source', sourceUrl: 'javascript:alert(1)', sourceType: 'other',
    capturedAt: '2026-11-08T00:00:00Z', evidenceClass: 'observed-fact', summary: 'Invalid URL fixture for a route contract test.',
    reliability: 'low', limitations: 'Security fixture only.', collectionMethod: 'Automated test', permissionBasis: 'Test fixture' }],
  scores: {}, scoreDetails: {}, hardGates: { rights: 'unknown', countryEligibility: 'unknown', channelPolicy: 'unknown', payoutFeasibility: 'unknown' },
  hardGateDetails: Object.fromEntries(['rights', 'countryEligibility', 'channelPolicy', 'payoutFeasibility'].map((key) => [key, { status: 'unknown', rationale: 'Not reviewed in this security test.', evidenceIds: [] }])),
}
const provenance = { creator: 'Test operator', license: 'Test fixture', editHistory: [], disclosure: 'Security test fixture.' }
const channelReview = (field, value) => ({
  countryEligibility: [{ country: 'ID', status: 'unknown', ...(field === 'country' ? { sourceUrl: value } : {}) }],
  payoutRequirements: { status: 'unknown', notes: 'Not checked in this security test.', ...(field === 'payout' ? { sourceUrl: value } : {}) },
  policyStatus: 'unknown', ...(field === 'policy' ? { policyUrl: value } : {}),
  manualFallback: 'The operator manually reviews and records this channel evidence.',
})

test('commerce routes reject unsafe evidence URLs before persistence', async () => {
  const database = createPool()
  const app = await createApp({ databasePool: database, logger: false, env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token } })
  const requests = [
    ['POST', '/api/v1/opportunities', opportunity],
    ['POST', '/api/v1/assets', { productVersionId, filename: 'test.txt', mediaType: 'text/plain', contentBase64: 'dGVzdA==', provenance: { ...provenance, sourceUrl: 'file:///etc/passwd' }, rightsState: 'unknown' }],
    ['POST', '/api/v1/inspections', { productVersionId, inspectionType: 'technical', status: 'needs-review', findings: [{ severity: 'info', description: 'Untrusted evidence link fixture.', evidenceUrl: 'data:text/html,unsafe' }] }],
    ['PATCH', '/api/v1/channels/' + recordId + '/review', channelReview('country', 'javascript:alert(1)')],
    ['PATCH', '/api/v1/channels/' + recordId + '/review', channelReview('payout', 'data:text/plain,unsafe')],
    ['PATCH', '/api/v1/channels/' + recordId + '/review', channelReview('policy', 'https://user:password@example.com/policy')],
    ['PATCH', '/api/v1/listings/' + recordId + '/publication-receipt', { providerReference: 'manual-receipt-001', evidenceUrl: 'file:///tmp/receipt.pdf', publishedAt: '2026-11-08T00:00:00Z' }],
    ['PATCH', '/api/v1/financial-events/' + recordId + '/reconciliation', { state: 'verified', rationale: 'Checked against provider statement.', evidenceUrl: 'javascript:alert(1)' }],
  ]
  try {
    for (const [method, url, payload] of requests) {
      const response = await app.inject({ method, url, headers, payload })
      assert.equal(response.statusCode, 400, method + ' ' + url + ': ' + response.body)
      assert.equal(response.json().error.code, 'VALIDATION_ERROR')
    }
    assert.equal(database.queryCount, 0, 'invalid evidence URLs must be rejected before database access')
  } finally { await app.close() }
})

test('HTTP(S) evidence URL schema accepts public web URLs and rejects malformed or credential-bearing URLs', () => {
  for (const value of ['http://example.com/source', 'https://example.com/source?ref=1']) assert.equal(httpUrlSchema.safeParse(value).success, true, value)
  for (const value of ['javascript:alert(1)', 'data:text/plain,unsafe', 'file:///tmp/evidence', 'mailto:operator@example.com', 'http://', 'https://user:password@example.com/source']) assert.equal(httpUrlSchema.safeParse(value).success, false, value)
})
