import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { OracleClientError } from '../src/oracle/client.ts'

const OPERATOR_TOKEN = 'arsy-operator-token-for-tests-32-characters'

function createFakePool() {
  return {
    query: async () => ({ rows: [{ ok: 1 }] }),
    end: async () => undefined,
  }
}

function createJob(overrides = {}) {
  return {
    job_id: '8b8a56ce-cd09-4fc3-bf8b-d83e6bd0fd44',
    task_type: 'statistics.describe',
    status: 'queued',
    submitted_at: '2026-11-08T00:00:00Z',
    started_at: null,
    completed_at: null,
    result: null,
    error: null,
    provenance: null,
    ...overrides,
  }
}

function createClient(overrides = {}) {
  const calls = { submissions: [], lookups: [] }
  const client = {
    submitJob: async (payload, idempotencyKey) => {
      calls.submissions.push({ payload, idempotencyKey })
      return { job: createJob(), replayed: false }
    },
    getJob: async (jobId) => {
      calls.lookups.push(jobId)
      return createJob({ status: 'succeeded', result: { mean: 4 } })
    },
    ...overrides,
  }
  return { client, calls }
}

function createTestApp({ client, env } = {}) {
  return createApp({
    databasePool: createFakePool(),
    logger: false,
    env: env ?? {
      ARSY_OPERATOR_ID: 'operator-test',
      ARSY_OPERATOR_TOKEN: OPERATOR_TOKEN,
    },
    oracleClient: client,
  })
}

const authHeaders = { 'x-arsy-operator-token': OPERATOR_TOKEN }

test('ORACLE API rejects unauthenticated calls before invoking the service client', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      payload: { task_type: 'statistics.describe', input: { values: [1, 2] } },
    })
    assert.equal(response.statusCode, 401)
    assert.equal(fake.calls.submissions.length, 0)
  } finally {
    await app.close()
  }
})

test('ORACLE API returns 503 when ARSY operator authentication is not configured', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client, env: {} })

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/oracle/jobs/8b8a56ce-cd09-4fc3-bf8b-d83e6bd0fd44',
      headers: authHeaders,
    })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
    assert.equal(fake.calls.lookups.length, 0)
  } finally {
    await app.close()
  }
})

test('ORACLE API validates and submits a job with the authenticated operator boundary', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      headers: { ...authHeaders, 'idempotency-key': 'analysis-run-001' },
      payload: {
        task_type: 'statistics.describe',
        input: { values: [2, 4, 6], label: 'sample' },
        evidence: [{ ref: 'witness:evidence-1' }],
      },
    })

    assert.equal(response.statusCode, 202)
    assert.equal(response.headers.location, '/api/v1/oracle/jobs/' + createJob().job_id)
    assert.equal(response.headers['idempotency-replayed'], 'false')
    assert.equal(response.json().data.job_id, createJob().job_id)
    assert.equal(response.json().meta.replayed, false)
    assert.equal(fake.calls.submissions.length, 1)
    assert.equal(fake.calls.submissions[0].idempotencyKey, 'analysis-run-001')
    assert.equal(fake.calls.submissions[0].payload.evidence[0].relation, 'wasDerivedFrom')
  } finally {
    await app.close()
  }
})

test('ORACLE API rejects malformed, oversized and unknown job input without an upstream call', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      headers: authHeaders,
      payload: {
        task_type: 'statistics.describe',
        input: { values: [1, 2], unexpected: true },
      },
    })
    const oversized = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      headers: authHeaders,
      payload: {
        task_type: 'text.profile',
        input: { text: 'x'.repeat(100_001) },
      },
    })

    assert.equal(malformed.statusCode, 422)
    assert.equal(oversized.statusCode, 422)
    assert.equal(fake.calls.submissions.length, 0)
  } finally {
    await app.close()
  }
})

test('ORACLE API validates idempotency key length and duplicate header forms', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      headers: { ...authHeaders, 'idempotency-key': 'k'.repeat(129) },
      payload: { task_type: 'statistics.describe', input: { values: [1] } },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'INVALID_IDEMPOTENCY_KEY')
    assert.equal(fake.calls.submissions.length, 0)
  } finally {
    await app.close()
  }
})

test('ORACLE API retrieves a job through ARSY and preserves its state/result', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/oracle/jobs/8b8a56ce-cd09-4fc3-bf8b-d83e6bd0fd44',
      headers: authHeaders,
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.status, 'succeeded')
    assert.equal(response.json().data.result.mean, 4)
    assert.deepEqual(fake.calls.lookups, [createJob().job_id])
  } finally {
    await app.close()
  }
})

test('ORACLE API rejects malformed job IDs before contacting ORACLE', async () => {
  const fake = createClient()
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/oracle/jobs/not-a-uuid',
      headers: authHeaders,
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'INVALID_ORACLE_JOB_ID')
    assert.equal(fake.calls.lookups.length, 0)
  } finally {
    await app.close()
  }
})

test('ORACLE API maps upstream saturation and retry hints to callers', async () => {
  const fake = createClient({
    submitJob: async () => {
      throw new OracleClientError('ORACLE busy', {
        status: 503,
        code: 'ORACLE_UNAVAILABLE',
        retryAfter: '5',
      })
    },
  })
  const app = createTestApp({ client: fake.client })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/oracle/jobs',
      headers: authHeaders,
      payload: { task_type: 'statistics.describe', input: { values: [1] } },
    })
    assert.equal(response.statusCode, 503)
    assert.equal(response.headers['retry-after'], '5')
    assert.equal(response.json().error.code, 'ORACLE_UNAVAILABLE')
  } finally {
    await app.close()
  }
})
