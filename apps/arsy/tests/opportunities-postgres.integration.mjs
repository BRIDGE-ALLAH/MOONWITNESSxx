import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createDatabasePool } from '../src/db.ts'
import { evaluateOpportunity } from '../src/opportunities/domain.ts'
import { OpportunityRepository } from '../src/opportunities/repository.ts'
import { applyTestMigrations } from './helpers/apply-migrations.mjs'

const scoreDetails = Object.fromEntries(
  ['demandEvidence', 'competitionGap', 'usefulnessDifferentiation', 'marketplaceFit', 'productionFeasibility', 'durability', 'distributionReadiness']
    .map((key) => [key, {
      rationale: 'The score is linked to the captured source and the operator review record.',
      confidence: 'medium',
      evidenceIds: ['opportunity-source-001'],
    }]),
)
const hardGates = {
  rights: 'pass',
  countryEligibility: 'pass',
  channelPolicy: 'pass',
  payoutFeasibility: 'pass',
}
const input = {
  title: 'Localized inventory utility',
  buyerProblem: 'Small sellers struggle to reconcile stock across multiple channels.',
  buyerSegment: 'Indonesian micro and small online sellers',
  jobToBeDone: 'Reconcile stock quantities and identify low-stock items.',
  productHypothesis: 'A localized utility template with stock movement and reorder checks.',
  productFamily: 'digital-utility',
  candidateChannels: ['Gumroad'],
  evidence: [{
    evidenceId: 'opportunity-source-001',
    sourceName: 'Public official documentation',
    sourceUrl: 'https://example.com/official-documentation',
    sourceType: 'official-documentation',
    capturedAt: '2026-11-09T00:00:00Z',
    evidenceClass: 'observed-fact',
    summary: 'The official documentation describes the required product format.',
    reliability: 'high',
    limitations: 'One source; no buyer interviews are represented by this fixture.',
    collectionMethod: 'Manual review of public official documentation',
    permissionBasis: 'Publicly accessible official documentation',
  }],
  scores: {
    demandEvidence: 20,
    competitionGap: 16,
    usefulnessDifferentiation: 12,
    marketplaceFit: 12,
    productionFeasibility: 8,
    durability: 8,
    distributionReadiness: 4,
  },
  scoreDetails,
  hardGates,
  hardGateDetails: Object.fromEntries(Object.entries(hardGates).map(([key, status]) => [key, {
    status,
    rationale: 'Reviewed for this isolated integration fixture; recheck before any real launch.',
    evidenceIds: ['opportunity-source-001'],
  }])),
}

test('PostgreSQL persists owner-scoped opportunities, idempotency, revisions, decisions and archive across reconnects', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `opportunity-integration-${randomUUID()}`
  const otherOwnerId = `opportunity-other-${randomUUID()}`
  const idempotencyKey = `opportunity-pg-${randomUUID()}`
  const migrationNames = [
    '002_money_maker_core.sql',
    '003_opportunity_version.sql',
    '004_product_promotion_lock.sql',
  ]
  let pool = createDatabasePool()
  let migrationsApplied = false
  try {
    const migrations = await Promise.all(migrationNames.map((name) =>
      readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
    ))
    await applyTestMigrations(pool, migrations)
    migrationsApplied = true

    const repository = new OpportunityRepository(pool)
    const evaluation = evaluateOpportunity(input)
    assert.equal(evaluation.score, 80)
    assert.equal(evaluation.decision, 'prototype-candidate')

    const created = await repository.create(ownerId, ownerId, input, evaluation, idempotencyKey)
    assert.equal(created.replayed, false)
    assert.equal(created.opportunity.version, 1)
    assert.equal(created.opportunity.evaluation.score, 80)

    const replayed = await repository.create(ownerId, ownerId, input, evaluation, idempotencyKey)
    assert.equal(replayed.replayed, true)
    assert.equal(replayed.opportunity.id, created.opportunity.id)

    await assert.rejects(
      repository.create(ownerId, ownerId, { ...input, title: 'Conflicting title' }, evaluation, idempotencyKey),
      /IDEMPOTENCY_KEY_REUSED/,
    )

    assert.equal(await repository.get(otherOwnerId, created.opportunity.id), null)
    assert.equal((await repository.list(ownerId)).length, 1)

    const changedInput = { ...input, title: 'Updated localized inventory utility' }
    const changedEvaluation = evaluateOpportunity(changedInput)
    const updated = await repository.update(
      ownerId,
      ownerId,
      created.opportunity.id,
      changedInput,
      changedEvaluation,
      1,
    )
    assert.equal(updated?.version, 2)
    assert.equal(updated?.title, changedInput.title)
    assert.equal(updated?.evaluation.decision, 'research-more')

    const decided = await repository.decide(
      ownerId,
      ownerId,
      created.opportunity.id,
      'prototype-candidate',
      'The evidence and hard gates were reviewed for this isolated integration fixture.',
    )
    assert.equal(decided?.version, 3)
    assert.equal(decided?.evaluation.decision, 'prototype-candidate')

    await pool.end()
    pool = createDatabasePool()
    const afterRestart = new OpportunityRepository(pool)
    const reloaded = await afterRestart.get(ownerId, created.opportunity.id)
    assert.ok(reloaded)
    assert.equal(reloaded.title, changedInput.title)
    assert.equal(reloaded.version, 3)
    assert.equal(reloaded.evaluation.decision, 'prototype-candidate')

    const auditBeforeArchive = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2 ORDER BY occurred_at',
      [ownerId, created.opportunity.id],
    )
    assert.deepEqual(
      auditBeforeArchive.rows.map((row) => row.action).sort(),
      ['created', 'decision-changed', 'updated'],
    )

    assert.equal(await afterRestart.archive(ownerId, ownerId, created.opportunity.id), true)
    assert.equal(await afterRestart.get(ownerId, created.opportunity.id), null)
    assert.equal((await afterRestart.list(ownerId)).length, 0)
    const archived = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2',
      [ownerId, created.opportunity.id],
    )
    assert.ok(archived.rows.some((row) => row.action === 'archived'))
  } finally {
    if (migrationsApplied) {
      await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = ANY($1::text[])', [[ownerId, otherOwnerId]]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_opportunities WHERE owner_id = ANY($1::text[])', [[ownerId, otherOwnerId]]).catch(() => undefined)
    }
    await pool.end()
  }
})
