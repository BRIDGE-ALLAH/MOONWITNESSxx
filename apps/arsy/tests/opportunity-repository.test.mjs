import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { OpportunityRepository } from '../src/opportunities/repository.ts'

function createDatabase(rows) {
  const calls = []
  return {
    calls,
    db: {
      query: async (sql, values) => {
        calls.push({ sql, values })
        return { rows: rows.shift() ?? [] }
      },
      end: async () => undefined,
    },
  }
}

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  revision: 1,
  title: 'Localized inventory utility',
  buyer_problem: 'Small sellers struggle to reconcile stock across channels.',
  buyer_segment: 'Indonesian micro sellers',
  job_to_be_done: 'Reconcile stock quantities and identify low-stock items.',
  product_hypothesis: 'A localized spreadsheet with reorder checks.',
  product_family: 'digital-utility',
  candidate_channels: ['Gumroad'],
  evidence: [{ evidenceId: 'evidence-1', sourceName: 'Official docs', sourceUrl: 'https://example.com/docs', evidenceClass: 'observed-fact' }],
  scores: { demandEvidence: 20, competitionGap: 16, usefulnessDifferentiation: 12, marketplaceFit: 12, productionFeasibility: 8, durability: 8, distributionReadiness: 4 },
  score_details: Object.fromEntries(['demandEvidence', 'competitionGap', 'usefulnessDifferentiation', 'marketplaceFit', 'productionFeasibility', 'durability', 'distributionReadiness'].map((key) => [key, { rationale: 'Evidence-backed rationale for this score dimension.', confidence: 'medium', evidenceIds: ['evidence-1'] }])),
  hard_gates: { rights: 'pass', countryEligibility: 'pass', channelPolicy: 'pass', payoutFeasibility: 'pass' },
  hard_gate_details: Object.fromEntries(['rights', 'countryEligibility', 'channelPolicy', 'payoutFeasibility'].map((key) => [key, { status: 'pass', rationale: 'Reviewed against evidence; recheck before publishing.', evidenceIds: ['evidence-1'] }])),
  score: '80.00',
  decision: 'prototype-candidate',
  decision_rationale: null,
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T00:00:00.000Z',
}

const input = {
  title: row.title,
  buyerProblem: row.buyer_problem,
  buyerSegment: row.buyer_segment,
  jobToBeDone: row.job_to_be_done,
  productHypothesis: row.product_hypothesis,
  productFamily: row.product_family,
  candidateChannels: row.candidate_channels,
  evidence: row.evidence,
  scores: row.scores,
  scoreDetails: row.score_details,
  hardGates: row.hard_gates,
  hardGateDetails: row.hard_gate_details,
}
const evaluation = {
  score: 80,
  decision: 'prototype-candidate',
  blockedGates: [],
  unknownGates: [],
  missingScoreDimensions: [],
}
const idempotencyKey = 'opportunity-test-0001'
const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')

test('creates a persisted opportunity with owner, actor and idempotency attribution', async () => {
  const fake = createDatabase([[row]])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.create('owner-a', 'owner-a', input, evaluation, idempotencyKey)

  assert.equal(result.opportunity.id, row.id)
  assert.equal(result.opportunity.evaluation.score, 80)
  assert.equal(result.replayed, false)
  assert.match(fake.calls[0].sql, /INSERT INTO arsy_opportunities/)
  assert.match(fake.calls[0].sql, /idempotency_key[\s\S]*request_hash/)
  assert.match(fake.calls[0].sql, /score_details[\s\S]*hard_gate_details/)
  assert.equal(fake.calls[0].values[11], JSON.stringify(row.score_details))
  assert.equal(fake.calls[0].values[13], JSON.stringify(row.hard_gate_details))
  assert.equal(fake.calls[0].values[16], idempotencyKey)
  assert.equal(fake.calls[0].values[17], requestHash)
  assert.equal(fake.calls[0].values[18], 'owner-a')
})

test('replays an identical opportunity create request without creating a second record', async () => {
  const fake = createDatabase([[], [{ ...row, request_hash: requestHash }]])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.create('owner-a', 'owner-a', input, evaluation, idempotencyKey)

  assert.equal(result.opportunity.id, row.id)
  assert.equal(result.replayed, true)
  assert.equal(fake.calls.length, 2)
  assert.match(fake.calls[1].sql, /WHERE owner_id = \$1 AND idempotency_key = \$2/)
})

test('rejects reuse of an opportunity idempotency key for a different request', async () => {
  const fake = createDatabase([[], [{ ...row, request_hash: '0'.repeat(64) }]])
  const repository = new OpportunityRepository(fake.db)
  await assert.rejects(
    repository.create('owner-a', 'owner-a', input, evaluation, idempotencyKey),
    /IDEMPOTENCY_KEY_REUSED/,
  )
})

test('preserves missing score dimensions when persisted opportunities are reloaded', async () => {
  const incompleteRow = {
    ...row,
    scores: { ...row.scores },
    score: null,
    decision: 'research-more',
  }
  delete incompleteRow.scores.distributionReadiness

  const fake = createDatabase([[incompleteRow]])
  const repository = new OpportunityRepository(fake.db)
  const [result] = await repository.list('owner-a')

  assert.deepEqual(result.evaluation.missingScoreDimensions, ['distributionReadiness'])
  assert.equal(result.evaluation.score, null)
  assert.equal(result.evaluation.decision, 'research-more')
})

test('scopes reads to the authenticated owner', async () => {
  const fake = createDatabase([[row]])
  const repository = new OpportunityRepository(fake.db)
  await repository.get('owner-a', row.id)
  assert.match(fake.calls[0].sql, /owner_id = \$1 AND id = \$2/)
  assert.deepEqual(fake.calls[0].values, ['owner-a', row.id])
})

test('archive is a reversible soft-state operation and owner scoped', async () => {
  const fake = createDatabase([[{ id: row.id }]])
  const repository = new OpportunityRepository(fake.db)
  assert.equal(await repository.archive('owner-a', 'owner-a', row.id), true)
  assert.match(fake.calls[0].sql, /archived_at = now\(\)/)
  assert.deepEqual(fake.calls[0].values.slice(0, 3), ['owner-a', row.id, 'owner-a'])
})


test('updates an opportunity only when the expected revision matches and advances the revision', async () => {
  const updatedRow = { ...row, revision: 2, title: 'Revised opportunity' }
  const fake = createDatabase([[updatedRow]])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.update('owner-a', 'owner-a', row.id, 1, { ...input, title: 'Revised opportunity' }, evaluation)

  assert.equal(result.status, 'updated')
  assert.equal(result.opportunity.revision, 2)
  assert.equal(result.opportunity.title, 'Revised opportunity')
  assert.match(fake.calls[0].sql, /revision = revision \+ 1/)
  assert.match(fake.calls[0].sql, /revision = \$3/)
  assert.match(fake.calls[0].sql, /NOT EXISTS[\s\S]*FROM arsy_products/)
  assert.equal(fake.calls[0].values[0], 'owner-a')
  assert.equal(fake.calls[0].values[1], row.id)
  assert.equal(fake.calls[0].values[2], 1)
  assert.equal(fake.calls[0].values[3], 'Revised opportunity')
})

test('rejects a stale opportunity revision and returns the current record without overwriting it', async () => {
  const latest = { ...row, revision: 2, title: 'Latest persisted title' }
  const fake = createDatabase([[], [latest], []])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.update('owner-a', 'owner-a', row.id, 1, { ...input, title: 'Stale overwrite' }, evaluation)

  assert.equal(result.status, 'stale')
  assert.equal(result.opportunity.revision, 2)
  assert.equal(result.opportunity.title, 'Latest persisted title')
  assert.equal(fake.calls.length, 3)
  assert.match(fake.calls[2].sql, /FROM arsy_products/)
})

test('prevents editing an opportunity after it has been promoted into a versioned product', async () => {
  const latest = { ...row, revision: 2 }
  const fake = createDatabase([[], [latest], [{ id: 'product-1' }]])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.update('owner-a', 'owner-a', row.id, 2, input, evaluation)

  assert.equal(result.status, 'promoted')
  assert.equal(fake.calls.length, 3)
})
