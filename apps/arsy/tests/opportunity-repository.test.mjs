import test from 'node:test'
import assert from 'node:assert/strict'
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

test('creates a persisted opportunity with owner and actor attribution', async () => {
  const fake = createDatabase([[row]])
  const repository = new OpportunityRepository(fake.db)
  const result = await repository.create('owner-a', 'owner-a', {
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
  }, {
    score: 80,
    decision: 'prototype-candidate',
    blockedGates: [],
    unknownGates: [],
    missingScoreDimensions: [],
  })

  assert.equal(result.id, row.id)
  assert.equal(result.evaluation.score, 80)
  assert.match(fake.calls[0].sql, /INSERT INTO arsy_opportunities/)
  assert.equal(fake.calls[0].values[0], 'owner-a')
  assert.equal(fake.calls[0].values.at(-1), 'owner-a')
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
  assert.deepEqual(fake.calls[0].values, ['owner-a', row.id, 'owner-a'])
})
