import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Pool } from 'pg'
import { evaluateOpportunity, opportunityInputSchema } from '../src/opportunities/domain.ts'
import { OpportunityRepository } from '../src/opportunities/repository.ts'

const connectionString = process.env.ARSY_TEST_DATABASE_URL

const dimensions = [
  'demandEvidence',
  'competitionGap',
  'usefulnessDifferentiation',
  'marketplaceFit',
  'productionFeasibility',
  'durability',
  'distributionReadiness',
]

const gates = ['rights', 'countryEligibility', 'channelPolicy', 'payoutFeasibility']

function opportunityInput() {
  const evidenceId = 'integration-evidence-1'
  const evidence = [{
    evidenceId,
    sourceName: 'Official public documentation',
    sourceUrl: 'https://example.com/official-docs',
    sourceType: 'official-documentation',
    capturedAt: '2026-11-08T00:00:00Z',
    evidenceClass: 'observed-fact',
    summary: 'The public documentation describes the relevant workflow and supported format.',
    reliability: 'high',
    limitations: 'One source only; independent corroboration is still required.',
    collectionMethod: 'Manual review of the public official documentation.',
    permissionBasis: 'Publicly accessible documentation; no authenticated scraping.',
  }]
  const scores = {
    demandEvidence: 25,
    competitionGap: 20,
    usefulnessDifferentiation: 15,
    marketplaceFit: 15,
    productionFeasibility: 10,
    durability: 10,
    distributionReadiness: 5,
  }
  const hardGates = Object.fromEntries(gates.map((gate) => [gate, 'pass']))
  return opportunityInputSchema.parse({
    title: 'Integration-test inventory utility',
    buyerProblem: 'Small sellers need a reliable way to reconcile inventory across sales channels.',
    buyerSegment: 'Indonesian micro and small online sellers',
    jobToBeDone: 'Reconcile stock levels and identify items requiring replenishment.',
    productHypothesis: 'A localized inventory utility with auditable stock adjustments.',
    productFamily: 'digital-utility',
    candidateChannels: ['manual-distribution'],
    evidence,
    scores,
    scoreDetails: Object.fromEntries(dimensions.map((dimension) => [dimension, {
      rationale: 'This score is supported by the cited evidence and its stated limitations.',
      confidence: 'medium',
      evidenceIds: [evidenceId],
    }])),
    hardGates,
    hardGateDetails: Object.fromEntries(gates.map((gate) => [gate, {
      status: 'pass',
      rationale: 'The gate was reviewed for this isolated integration fixture.',
      evidenceIds: [evidenceId],
    }])),
  })
}

test('opportunity CRUD and audit persist in PostgreSQL across pool reconnect', {
  skip: !connectionString ? 'ARSY_TEST_DATABASE_URL is not configured' : false,
}, async () => {
  let pool = new Pool({ connectionString, max: 2 })
  const ownerId = randomUUID()
  const actorId = ownerId

  try {
    for (const migration of ['001_arsy_evidence_events.sql', '002_money_maker_core.sql']) {
      const sql = await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8')
      await pool.query(sql)
    }

    const input = opportunityInput()
    const evaluation = evaluateOpportunity(input)
    const repository = new OpportunityRepository(pool)
    const created = await repository.create(ownerId, actorId, input, evaluation)

    assert.equal(created.title, input.title)
    assert.equal(created.evaluation.score, 100)
    assert.equal(created.evaluation.decision, 'prototype-candidate')
    assert.equal((await repository.list(ownerId)).length, 1)
    assert.equal((await repository.get(ownerId, created.id))?.id, created.id)
    assert.equal(await repository.get(randomUUID(), created.id), null)

    await pool.end()
    pool = new Pool({ connectionString, max: 2 })
    const reconnectedRepository = new OpportunityRepository(pool)
    const persisted = await reconnectedRepository.get(ownerId, created.id)
    assert.equal(persisted?.id, created.id)
    assert.equal(persisted?.evidence[0]?.sourceUrl, input.evidence[0].sourceUrl)

    const decided = await reconnectedRepository.decide(ownerId, actorId, created.id, 'park', 'Park pending independent evidence corroboration.')
    assert.equal(decided?.evaluation.decision, 'park')
    assert.equal(decided?.decisionRationale, 'Park pending independent evidence corroboration.')

    assert.equal(await reconnectedRepository.archive(ownerId, actorId, created.id), true)
    assert.equal(await reconnectedRepository.get(ownerId, created.id), null)

    const audit = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2 ORDER BY occurred_at ASC',
      [ownerId, created.id],
    )
    assert.deepEqual(audit.rows.map((row) => row.action).sort(), ['archived', 'created', 'decision-changed'].sort())
  } finally {
    if (!pool.ended) {
      await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_opportunities WHERE owner_id = $1', [ownerId]).catch(() => undefined)
      await pool.end()
    }
  }
})
