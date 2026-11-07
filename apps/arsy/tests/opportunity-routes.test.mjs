import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const evidence = [{
  sourceName: 'Official documentation',
  sourceUrl: 'https://example.com/docs',
  sourceType: 'official-documentation',
  capturedAt: '2026-11-08T00:00:00Z',
  evidenceClass: 'observed-fact',
  summary: 'Public official docs describe the required format.',
  reliability: 'high',
  limitations: 'Single official source; no independent corroboration yet.',
  evidenceId: 'evidence-1',
  collectionMethod: 'Manual review of public documentation',
  permissionBasis: 'Publicly accessible official documentation',
}]
const scores = {
  demandEvidence: 20,
  competitionGap: 16,
  usefulnessDifferentiation: 12,
  marketplaceFit: 12,
  productionFeasibility: 8,
  durability: 8,
  distributionReadiness: 4,
}
const hardGates = { rights: 'pass', countryEligibility: 'pass', channelPolicy: 'pass', payoutFeasibility: 'pass' }
const body = {
  title: 'Localized inventory utility',
  buyerProblem: 'Small sellers struggle to reconcile stock across several channels.',
  buyerSegment: 'Indonesian micro and small sellers',
  jobToBeDone: 'Reconcile stock quantities and identify low-stock items.',
  productHypothesis: 'A localized spreadsheet with reorder checks.',
  productFamily: 'digital-utility',
  candidateChannels: ['Gumroad'],
  evidence,
  scores,
  scoreDetails: Object.fromEntries(Object.keys(scores).map((key) => [key, {
    rationale: 'The score is supported by the cited public documentation and review notes.',
    confidence: 'medium',
    evidenceIds: ['evidence-1'],
  }])),
  hardGates,
  hardGateDetails: Object.fromEntries(Object.entries(hardGates).map(([key, status]) => [key, {
    status,
    rationale: 'Reviewed against current official documentation; recheck before publication.',
    evidenceIds: ['evidence-1'],
  }])),
}

function fakePool() {
  return {
    query: async (sql) => {
      if (sql.includes('INSERT INTO arsy_opportunities')) {
        return { rows: [{
          id: '11111111-1111-4111-8111-111111111111',
          title: body.title,
          buyer_problem: body.buyerProblem,
          buyer_segment: body.buyerSegment,
          job_to_be_done: body.jobToBeDone,
          product_hypothesis: body.productHypothesis,
          product_family: body.productFamily,
          candidate_channels: body.candidateChannels,
          evidence: body.evidence,
          scores: body.scores,
          score_details: body.scoreDetails,
          hard_gates: body.hardGates,
          hard_gate_details: body.hardGateDetails,
          score: '80.00',
          decision: 'prototype-candidate',
          decision_rationale: null,
          created_at: '2026-11-08T00:00:00.000Z',
          updated_at: '2026-11-08T00:00:00.000Z',
        }] }
      }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('opportunity routes fail closed when operator auth is not configured', async () => {
  const app = createApp({ databasePool: fakePool(), logger: false, env: {} })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities' })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})

test('opportunity routes require a valid operator token', async () => {
  const app = createApp({ databasePool: fakePool(), logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
  try {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/opportunities' })
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/opportunities', headers: { 'x-arsy-operator-token': 'wrong' } })
    assert.equal(missing.statusCode, 401)
    assert.equal(invalid.statusCode, 401)
  } finally {
    await app.close()
  }
})

test('authenticated operator can create and list a persisted opportunity', async () => {
  const app = createApp({ databasePool: fakePool(), logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token },
      payload: body,
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.evaluation.score, 80)
    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(listed.statusCode, 200)
    assert.equal(listed.json().data.length, 0)
  } finally {
    await app.close()
  }
})
