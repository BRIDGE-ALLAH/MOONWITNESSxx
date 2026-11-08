import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = (process.env.ARSY_E2E_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
const operatorToken = process.env.ARSY_OPERATOR_TOKEN

if (!operatorToken || operatorToken.length < 32) {
  throw new Error('ARSY_OPERATOR_TOKEN must be set to a CI-only token of at least 32 characters')
}

const headers = {
  'content-type': 'application/json',
  'x-arsy-operator-token': operatorToken,
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function readJob(jobId) {
  const response = await fetch(baseUrl + '/api/v1/oracle/jobs/' + encodeURIComponent(jobId), {
    headers: { 'x-arsy-operator-token': operatorToken },
    signal: AbortSignal.timeout(5_000),
  })

  assert.equal(response.status, 200, 'ARSY must return the ORACLE job through its authenticated API')
  return (await response.json()).data
}

async function submitAndWait(payload, idempotencyKey) {
  const response = await fetch(baseUrl + '/api/v1/oracle/jobs', {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': idempotencyKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  })

  const envelope = await response.json()
  assert.equal(response.status, 202, JSON.stringify(envelope))
  assert.equal(envelope.meta.replayed, false)

  const acceptedJob = envelope.data
  assert.ok(acceptedJob.job_id, 'ARSY must return the ORACLE-generated job ID')

  const deadline = Date.now() + 20_000
  let job = acceptedJob

  while (Date.now() < deadline) {
    job = await readJob(acceptedJob.job_id)
    if (job.status === 'succeeded') return job
    if (job.status === 'failed') {
      assert.fail('ORACLE job failed: ' + JSON.stringify(job.error))
    }
    await sleep(150)
  }

  assert.fail('ORACLE job did not finish within 20 seconds; last state: ' + job.status)
}

test('real ARSY-to-ORACLE statistics job returns computed result and provenance', {
  timeout: 30_000,
}, async () => {
  const payload = {
    task_type: 'statistics.describe',
    input: { values: [10, 12, 15, 19], label: 'compose-e2e' },
    evidence: [{ ref: 'witness:e2e:oracle-compose', relation: 'wasDerivedFrom' }],
  }

  const job = await submitAndWait(payload, 'oracle-compose-statistics-001')

  assert.equal(job.task_type, 'statistics.describe')
  assert.equal(job.status, 'succeeded')
  assert.equal(job.result.count, 4)
  assert.equal(job.result.mean, 14)
  assert.equal(job.result.median, 13.5)
  assert.equal(job.provenance.engine, 'ORACLE')
  assert.match(job.provenance.input_digest, /^[a-f0-9]{64}$/)
  assert.match(job.provenance.output_digest, /^[a-f0-9]{64}$/)
  assert.deepEqual(job.provenance.evidence, payload.evidence)

  const replayResponse = await fetch(baseUrl + '/api/v1/oracle/jobs', {
    method: 'POST',
    headers: { ...headers, 'idempotency-key': 'oracle-compose-statistics-001' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  })
  const replay = await replayResponse.json()
  assert.equal(replayResponse.status, 202, JSON.stringify(replay))
  assert.equal(replay.meta.replayed, true)
  assert.equal(replay.data.job_id, job.job_id)
})

test('real ARSY-to-ORACLE text profile job returns bounded lexical analysis', {
  timeout: 30_000,
}, async () => {
  const job = await submitAndWait(
    {
      task_type: 'text.profile',
      input: { text: 'MoonWitness observes carefully. Evidence remains traceable.', language_hint: 'en' },
    },
    'oracle-compose-text-profile-001',
  )

  assert.equal(job.status, 'succeeded')
  assert.equal(job.result.language_hint, 'en')
  assert.equal(job.result.word_count, 6)
  assert.equal(job.provenance.engine, 'ORACLE')
  assert.equal(job.provenance.method_id, 'oracle.text.profile')
})
