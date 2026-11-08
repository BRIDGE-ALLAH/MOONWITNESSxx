import test from 'node:test'
import assert from 'node:assert/strict'
import { OracleClientError, createOracleClient } from '../src/oracle/client.ts'

const token = 'oracle-service-token-for-tests-long-enough-32'

function jobView(overrides = {}) {
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

function createResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

test('ORACLE client forwards bearer auth and idempotency key to the internal API', async () => {
  let received
  const client = createOracleClient(
    {
      ORACLE_BASE_URL: 'http://oracle:8010',
      ORACLE_SERVICE_TOKEN: token,
    },
    async (url, init) => {
      received = { url, init }
      return createResponse({ job: jobView(), replayed: false }, 202)
    },
  )

  const result = await client.submitJob(
    { task_type: 'statistics.describe', input: { values: [2, 4, 6] } },
    'run-123',
  )

  assert.equal(received.url, 'http://oracle:8010/v1/jobs')
  assert.equal(received.init.headers.authorization, 'Bearer ' + token)
  assert.equal(received.init.headers['idempotency-key'], 'run-123')
  assert.equal(result.job.job_id, jobView().job_id)
  assert.equal(result.replayed, false)
})

test('ORACLE client retrieves and validates job status', async () => {
  let requestedUrl
  const client = createOracleClient(
    { ORACLE_BASE_URL: 'http://oracle:8010', ORACLE_SERVICE_TOKEN: token },
    async (url) => {
      requestedUrl = url
      return createResponse(jobView({ status: 'succeeded', result: { mean: 4 } }))
    },
  )

  const job = await client.getJob(jobView().job_id)

  assert.equal(requestedUrl, 'http://oracle:8010/v1/jobs/' + jobView().job_id)
  assert.equal(job.status, 'succeeded')
  assert.equal(job.result.mean, 4)
})

test('ORACLE client fails closed when service settings are missing or invalid', async () => {
  const missing = createOracleClient({})
  await assert.rejects(
    missing.getJob(jobView().job_id),
    (error) => error instanceof OracleClientError && error.status === 503 && error.code === 'ORACLE_NOT_CONFIGURED',
  )

  const invalid = createOracleClient({
    ORACLE_BASE_URL: 'http://user:password@oracle:8010/path',
    ORACLE_SERVICE_TOKEN: token,
  })
  await assert.rejects(
    invalid.getJob(jobView().job_id),
    (error) => error instanceof OracleClientError && error.code === 'ORACLE_CONFIG_INVALID',
  )
})

test('ORACLE client maps idempotency conflicts and forwards retry-after safely', async () => {
  const conflict = createOracleClient(
    { ORACLE_BASE_URL: 'http://oracle:8010', ORACLE_SERVICE_TOKEN: token },
    async () => createResponse({ detail: 'private detail' }, 409),
  )
  await assert.rejects(
    conflict.submitJob({ task_type: 'statistics.describe', input: { values: [1] } }),
    (error) => error instanceof OracleClientError && error.status === 409 &&
      error.code === 'ORACLE_IDEMPOTENCY_CONFLICT' && !error.message.includes('private detail'),
  )

  const saturated = createOracleClient(
    { ORACLE_BASE_URL: 'http://oracle:8010', ORACLE_SERVICE_TOKEN: token },
    async () => createResponse({ detail: 'queue full' }, 503, { 'retry-after': '5' }),
  )
  await assert.rejects(
    saturated.submitJob({ task_type: 'statistics.describe', input: { values: [1] } }),
    (error) => error instanceof OracleClientError && error.status === 503 && error.retryAfter === '5',
  )
})

test('ORACLE client reduces network failures to a safe unavailable error', async () => {
  const client = createOracleClient(
    { ORACLE_BASE_URL: 'http://oracle:8010', ORACLE_SERVICE_TOKEN: token },
    async () => { throw new Error('private socket configuration') },
  )

  await assert.rejects(
    client.getJob(jobView().job_id),
    (error) => error instanceof OracleClientError && error.status === 503 &&
      error.code === 'ORACLE_UNAVAILABLE' && !error.message.includes('private socket'),
  )
})

test('ORACLE client rejects a response that does not match the versioned contract', async () => {
  const client = createOracleClient(
    { ORACLE_BASE_URL: 'http://oracle:8010', ORACLE_SERVICE_TOKEN: token },
    async () => createResponse({ job: { job_id: 'not-a-uuid' }, replayed: false }, 202),
  )

  await assert.rejects(
    client.submitJob({ task_type: 'statistics.describe', input: { values: [1] } }),
    (error) => error instanceof OracleClientError && error.status === 502 &&
      error.code === 'ORACLE_INVALID_RESPONSE',
  )
})
