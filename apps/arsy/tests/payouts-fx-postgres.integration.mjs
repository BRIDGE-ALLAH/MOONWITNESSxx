import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { ChannelRepository } from '../src/channels/repository.ts'
import { FinancialRepository } from '../src/finance/repository.ts'
import {
  FxConversionRepository,
  PayoutRepository,
} from '../src/finance/payouts.ts'

test('PostgreSQL persists payout lifecycle, linked ledger movements and exact FX conversion across reconnects', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `payout-fx-integration-${randomUUID()}`
  const otherOwner = `${ownerId}-other`
  const slug = `payout-${randomUUID()}`
  let pool = createDatabasePool()

  try {
    const channels = new ChannelRepository(pool)
    const now = new Date().toISOString()
    const channel = await channels.create(ownerId, ownerId, {
      channelKey: slug,
      displayName: 'Payout FX integration fixture',
      countryCode: 'ID',
      accountEligibility: 'eligible',
      officialPolicyUrl: 'https://example.com/policy',
      policyReviewedAt: now,
      policyRecheckAt: new Date(Date.now() + 86_400_000).toISOString(),
      payoutRequirements: { status: 'verified', sourceUrl: 'https://example.com/payout' },
      listingRequirements: {},
      payoutSetupStatus: 'configured',
      capability: 'C1',
      grantedScopes: [],
      quotaNotes: {},
      channelStatus: 'active',
      evidence: [
        {
          evidenceType: 'account-eligibility',
          sourceName: 'Synthetic integration eligibility fixture',
          sourceUrl: 'https://example.com/country',
          capturedAt: now,
          reviewedAt: now,
          evidenceClass: 'observed-fact',
          summary: 'Synthetic fixture records operator-verified eligibility for ID.',
          limitations: 'Integration fixture only; recheck before any real payout.',
        },
        {
          evidenceType: 'payout-requirements',
          sourceName: 'Synthetic integration payout fixture',
          sourceUrl: 'https://example.com/payout',
          capturedAt: now,
          reviewedAt: now,
          evidenceClass: 'observed-fact',
          summary: 'Synthetic fixture records payout requirements and configured account status.',
          limitations: 'Integration fixture only; no provider API call is made.',
        },
      ],
    })
    assert.equal(channel.capability, 'C1')
    assert.equal(channel.accountEligibility, 'eligible')

    const payouts = new PayoutRepository(pool)
    const payoutInput = {
      channelId: channel.id,
      amountMinor: '5000',
      currency: 'IDR',
      expectedAt: now,
      providerReference: `provider-payout-${randomUUID()}`,
      source: 'Synthetic integration statement fixture',
      idempotencyKey: `payout-create-${randomUUID()}`,
      evidenceUrl: 'https://example.com/payout-statement',
      evidenceCapturedAt: now,
      evidenceSummary: 'Synthetic fixture representing a pending payout line.',
    }
    const created = await payouts.create(ownerId, ownerId, payoutInput)
    assert.ok(created)
    assert.equal(created.payout.status, 'pending')
    assert.equal(created.replayed, false)
    const replay = await payouts.create(ownerId, ownerId, payoutInput)
    assert.equal(replay?.replayed, true)
    assert.equal(replay?.payout.id, created.payout.id)

    const paid = await payouts.transition(
      ownerId, ownerId, created.payout.id, 'paid',
      'Synthetic integration fixture matched to a bank statement.',
      'https://example.com/paid-statement', now,
    )
    assert.equal(paid?.status, 'paid')

    // A paid payout may later be disputed, but it cannot become failed without
    // a reversal ledger movement. A paid_at value is evidence that payment
    // occurred; only an explicit reversal can neutralize that movement.
    const disputed = await payouts.transition(
      ownerId, ownerId, created.payout.id, 'disputed',
      'Synthetic integration fixture tests a post-payment dispute.',
      'https://example.com/dispute-statement', now,
    )
    assert.equal(disputed?.status, 'disputed')
    assert.deepEqual(disputed?.allowedNextStatuses, ['paid', 'reversed'])
    assert.equal(disputed?.allowedNextStatuses.includes('failed'), false)
    assert.equal(await payouts.transition(
      ownerId, ownerId, created.payout.id, 'failed',
      'A previously paid payout cannot be marked failed without a reversal.',
      'https://example.com/invalid-failed-after-paid', now,
    ), null)

    const reversed = await payouts.transition(
      ownerId, ownerId, created.payout.id, 'reversed',
      'Synthetic integration fixture tests a payout reversal.',
      'https://example.com/reversal-statement', now,
    )
    assert.equal(reversed?.status, 'reversed')
    assert.equal(await payouts.transition(
      ownerId, ownerId, created.payout.id, 'paid',
      'A reversed payout cannot return to paid.',
      'https://example.com/invalid-transition', now,
    ), null)

    const finance = new FinancialRepository(pool)
    const sourceEvent = await finance.create(ownerId, ownerId, {
      eventType: 'gross-receipt',
      amountMinor: '10000',
      currency: 'IDR',
      occurredAt: now,
      source: 'Synthetic integration FX source event',
      idempotencyKey: `fx-source-${randomUUID()}`,
    })
    assert.ok(sourceEvent)
    const verifiedSource = await finance.reconcile(
      ownerId, ownerId, sourceEvent.event.id, 'verified',
      'Synthetic integration fixture marks the source event verified.',
      'https://example.com/source-statement',
    )
    assert.equal(verifiedSource?.reconciliationState, 'verified')

    const fx = new FxConversionRepository(pool)
    const fxInput = {
      sourceEventId: sourceEvent.event.id,
      fromAmountMinor: '10000',
      fromCurrency: 'IDR',
      toAmountMinor: '100',
      toCurrency: 'USD',
      rateNumerator: '1',
      rateDenominator: '100',
      rateSource: 'Synthetic exact rational integration fixture',
      sourceUrl: 'https://example.com/fx-source',
      observedAt: now,
      idempotencyKey: `fx-conversion-${randomUUID()}`,
    }
    const conversion = await fx.create(ownerId, ownerId, fxInput)
    assert.ok(conversion)
    assert.equal(conversion.conversion.toAmountMinor, '100')
    assert.equal(conversion.conversion.rateNumerator, '1')
    assert.equal(conversion.conversion.rateDenominator, '100')

    await pool.end()
    pool = createDatabasePool()

    const persistedPayouts = new PayoutRepository(pool)
    const payoutRows = await persistedPayouts.list(ownerId)
    assert.equal(payoutRows.length, 1)
    assert.equal(payoutRows[0].status, 'reversed')
    assert.equal(payoutRows[0].history.length, 4)
    assert.equal((await persistedPayouts.list(otherOwner)).length, 0)

    const events = await new FinancialRepository(pool).list(ownerId)
    const payoutMovements = events.filter((event) => event.providerReference === payoutInput.providerReference)
    assert.deepEqual(payoutMovements.map((event) => event.eventType).sort(), ['payout', 'payout-reversal'])
    assert.ok(payoutMovements.every((event) => event.reconciliationState === 'verified'))

    const [summary] = await new FinancialRepository(pool).summary(ownerId)
    assert.equal(summary.payout_movements_minor, '0')
    assert.equal(summary.gross_receipts_minor, '10000')

    const conversions = await new FxConversionRepository(pool).list(ownerId)
    assert.equal(conversions.length, 1)
    assert.equal(conversions[0].fromCurrency, 'IDR')
    assert.equal(conversions[0].toCurrency, 'USD')
    assert.equal(conversions[0].toAmountMinor, '100')
    assert.equal((await new FxConversionRepository(pool).list(otherOwner)).length, 0)
  } finally {
    await pool.end()
  }
})
