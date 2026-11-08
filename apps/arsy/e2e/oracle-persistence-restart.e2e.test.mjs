import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const baseUrl = (process.env.ARSY_E2E_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const operatorToken = process.env.ARSY_OPERATOR_TOKEN
const reportPath = process.env.ORACLE_E2E_PERSISTENCE_REPORT ?? '/tmp/oracle-persistence-report.json'

if (!operatorToken || operatorToken.length < 32) {
  throw new Error('ARSY_OPERATOR_TOKEN must be set to a CI-only token of at least 32 characters')
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const authHeaders = { 'x-arsy-operator-token': operatorToken }

test('ORACLE job result and idempotency survive a real service restart', async () => {
  const read = await fetch(
    baseUrl + '/api/v1/oracle/jobs/' + encodeURIComponent(report.jobId),
    { headers: authHeaders, signal: AbortSignal.timeout(5_000) },
  )
  assert.equal(read.status, 200)
  const job = (await read.json()).data
  assert.equal(job.job_id, report.jobId)
  assert.equal(job.status, 'succeeded')
  assert.equal(job.result.mean, 14)
  assert.equal(job.provenance.engine, 'ORACLE')
  assert.match(job.provenance.output_digest, /^[a-f0-9]{64}$/)

  const replay = await fetch(baseUrl + '/api/v1/oracle/jobs', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'content-type': 'application/json',
      'idempotency-key': report.idempotencyKey,
    },
    body: JSON.stringify(report.payload),
    signal: AbortSignal.timeout(5_000),
  })
  const envelope = await replay.json()
  assert.equal(replay.status, 202, JSON.stringify(envelope))
  assert.equal(envelope.meta.replayed, true)
  assert.equal(envelope.data.job_id, report.jobId)
})
