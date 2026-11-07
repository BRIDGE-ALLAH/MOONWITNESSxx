import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const operatorId = 'operator-test'
const idempotencyKey = 'opportunity-route-test-0001'
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
  const records = []
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push(sql)
      if (sql.includes('UPDATE arsy_opportunities')) {
        const current = records.find((record) => record.id === values[1])
        if (!current || current.revision !== values[2]) return { rows: [] }
        Object.assign(current, {
          title: values[3],
          buyer_problem: values[4],
          buyer_segment: values[5],
          job_to_be_done: values[6],
          product_hypothesis: values[7],
          product_family: values[8],
          candidate_channels: JSON.parse(values[9]),
          evidence: JSON.parse(values[10]),
          scores: JSON.parse(values[11]),
          score_details: JSON.parse(values[12]),
          hard_gates: JSON.parse(values[13]),
          hard_gate_details: JSON.parse(values[14]),
          score: values[15] === null ? null : String(values[15]),
          decision: values[16],
          decision_rationale: null,
          revision: current.revision + 1,
          updated_at: '2026-11-08T01:00:00.000Z',
        })
        return { rows: [{ ...current }] }
      }
      if (sql.includes('SELECT id FROM arsy_products')) return { rows: [] }
      if (sql.includes('INSERT INTO arsy_opportunities')) {
        const key = values[16]
        if (records.some((record) => record.idempotency_key === key)) return { rows: [] }
        const record = {
          id: '11111111-1111-4111-8111-111111111111',
          revision: 1,
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
          idempotency_key: key,
          request_hash: values[17],
          created_at: '2026-11-08T00:00:00.000Z',
          updated_at: '2026-11-08T00:00:00.000Z',
        }
        records.push(record)
        return { rows: [record] }
      }
      if (sql.includes('FROM arsy_opportunities')) return { rows: records }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('opportunity routes fail closed when operator auth is not configured', async () => {
  const app = await createApp({ databasePool: fakePool(), logger: false, env: {} })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities' })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})

test('opportunity routes fail closed when operator identity is not configured', async () => {
  const app = await createApp({ databasePool: fakePool(), logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities' })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})

test('opportunity routes require a valid operator token', async () => {
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: fakePool(), logger: false, env })
  try {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/opportunities' })
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/opportunities', headers: { 'x-arsy-operator-token': 'wrong' } })
    assert.equal(missing.statusCode, 401)
    assert.equal(invalid.statusCode, 401)
  } finally {
    await app.close()
  }
})

test('authenticated operator create/list routes return the inserted record', async () => {
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: fakePool(), logger: false, env })
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': idempotencyKey },
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
    assert.equal(listed.json().data.length, 1)
    assert.equal(listed.json().data[0].id, created.json().data.id)
  } finally {
    await app.close()
  }
})

 
test('opportunity create replays identical idempotency keys and rejects changed payloads', async () => {
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: fakePool(), logger: false, env })
  try {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': idempotencyKey },
      payload: body,
    })
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': idempotencyKey },
      payload: body,
    })
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': idempotencyKey },
      payload: { ...body, title: 'Different opportunity under reused key' },
    })
    assert.equal(first.statusCode, 201)
    assert.equal(replay.statusCode, 200)
    assert.equal(replay.json().replayed, true)
    assert.equal(replay.json().data.id, first.json().data.id)
    assert.equal(conflict.statusCode, 409)
    assert.equal(conflict.json().error.code, 'IDEMPOTENCY_CONFLICT')
  } finally {
    await app.close()
  }
})

test('all versioned business API groups reject anonymous requests before database access', async () => {
  const pool = fakePool()
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: pool, logger: false, env })
  const id = '11111111-1111-4111-8111-111111111111'
  const requests = [
    { method: 'GET', url: '/api/v1/products' },
    { method: 'POST', url: '/api/v1/products/from-opportunity', payload: { opportunityId: id, acceptanceCriteria: ['A measurable acceptance criterion'] } },
    { method: 'GET', url: `/api/v1/products/${id}` },
    { method: 'GET', url: '/api/v1/financial-events' },
    { method: 'POST', url: '/api/v1/financial-events', payload: {
      eventType: 'gross-receipt', amountMinor: '1000', currency: 'IDR',
      occurredAt: '2026-11-08T00:00:00Z', source: 'test evidence', idempotencyKey: 'test-key-0001',
    } },
    { method: 'PATCH', url: `/api/v1/financial-events/${id}/reconciliation`, payload: {
      state: 'verified', rationale: 'Test reconciliation rationale.', evidenceUrl: 'https://example.com/evidence',
    } },
    { method: 'GET', url: '/api/v1/financial-summary' },
  ]
  try {
    for (const request of requests) {
      const response = await app.inject(request)
      assert.equal(response.statusCode, 401, `Expected authentication for ${request.method} ${request.url}`)
    }
    assert.equal(pool.calls.length, 0, 'unauthorized business requests must not reach repositories')
  } finally {
    await app.close()
  }
})


test('opportunity content updates validate input, increment revision and reject stale writes', async () => {
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: fakePool(), logger: false, env })
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/opportunities',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'revision-test-0001' },
      payload: body,
    })
    assert.equal(created.statusCode, 201)
    const id = created.json().data.id
    assert.equal(created.json().data.revision, 1)

    const revisedInput = { ...body, title: 'Revised localized inventory utility' }
    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/opportunities/' + id,
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedRevision: 1, input: revisedInput },
    })
    assert.equal(updated.statusCode, 200)
    assert.equal(updated.json().data.revision, 2)
    assert.equal(updated.json().data.title, revisedInput.title)

    const stale = await app.inject({
      method: 'PATCH',
      url: '/api/v1/opportunities/' + id,
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedRevision: 1, input: { ...revisedInput, title: 'Must not overwrite revision 2' } },
    })
    assert.equal(stale.statusCode, 409)
    assert.equal(stale.json().error.code, 'STALE_WRITE')
    assert.equal(stale.json().current.revision, 2)
    assert.equal(stale.json().current.title, revisedInput.title)
  } finally {
    await app.close()
  }
})

test('opportunity content update rejects malformed source data and missing revision', async () => {
  const env = { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token }
  const app = await createApp({ databasePool: fakePool(), logger: false, env })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/opportunities/11111111-1111-4111-8111-111111111111',
      headers: { 'x-arsy-operator-token': token },
      payload: { input: { ...body, evidence: [] } },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'VALIDATION_ERROR')
  } finally {
    await app.close()
  }
})
