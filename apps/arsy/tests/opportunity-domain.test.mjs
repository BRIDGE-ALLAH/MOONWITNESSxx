import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateOpportunity,
  opportunityInputSchema,
} from '../src/opportunities/domain.ts'

const completeScores = {
  demandEvidence: 20,
  competitionGap: 16,
  usefulnessDifferentiation: 12,
  marketplaceFit: 12,
  productionFeasibility: 8,
  durability: 8,
  distributionReadiness: 4,
}

const passingGates = {
  rights: 'pass',
  countryEligibility: 'pass',
  channelPolicy: 'pass',
  payoutFeasibility: 'pass',
}

const evidence = {
  evidenceId: 'evidence-policy-001',
  sourceName: 'Official marketplace policy',
  sourceUrl: 'https://example.com/policy',
  sourceType: 'official-documentation',
  capturedAt: '2026-11-08T00:00:00Z',
  evidenceClass: 'observed-fact',
  summary: 'The current official documentation describes the required product format.',
  reliability: 'high',
  limitations: 'One official source; no buyer interviews have been conducted.',
  collectionMethod: 'Manual review of public official documentation',
  permissionBasis: 'Publicly accessible official documentation',
}

const validOpportunity = {
  title: 'Localized inventory utility',
  buyerProblem: 'Small sellers struggle to reconcile stock across several channels.',
  buyerSegment: 'Indonesian micro and small online sellers',
  jobToBeDone: 'Reconcile stock quantities and identify low-stock items.',
  productHypothesis: 'A localized spreadsheet with stock movement and reorder checks.',
  productFamily: 'digital-utility',
  candidateChannels: ['Etsy', 'Gumroad'],
  evidence: [evidence],
  scores: completeScores,
  scoreDetails: Object.fromEntries(Object.keys(completeScores).map((key) => [key, {
    rationale: 'This score is supported by the cited official source and current review notes.',
    confidence: 'medium',
    evidenceIds: ['evidence-policy-001'],
  }])),
  hardGates: passingGates,
  hardGateDetails: Object.fromEntries(Object.entries(passingGates).map(([key, status]) => [key, {
    status,
    rationale: 'Reviewed against the current official source; eligibility must be rechecked before launch.',
    evidenceIds: ['evidence-policy-001'],
  }]))
}

test('accepts a complete evidence-backed opportunity input', () => {
  const result = opportunityInputSchema.safeParse(validOpportunity)
  assert.equal(result.success, true)
})

test('rejects an opportunity without evidence or a valid source URL', () => {
  const noEvidence = opportunityInputSchema.safeParse({
    ...validOpportunity,
    evidence: [],
  })
  const invalidUrl = opportunityInputSchema.safeParse({
    ...validOpportunity,
    evidence: [{ ...evidence, sourceUrl: 'not-a-url' }],
  })

  assert.equal(noEvidence.success, false)
  assert.equal(invalidUrl.success, false)
})

test('requires evidence references and rationale for every scored dimension', () => {
  const missingRationale = opportunityInputSchema.safeParse({
    ...validOpportunity,
    scoreDetails: { ...validOpportunity.scoreDetails, demandEvidence: undefined },
  })
  const unknownEvidence = opportunityInputSchema.safeParse({
    ...validOpportunity,
    scoreDetails: {
      ...validOpportunity.scoreDetails,
      demandEvidence: { ...validOpportunity.scoreDetails.demandEvidence, evidenceIds: ['missing-evidence'] },
    },
  })
  assert.equal(missingRationale.success, false)
  assert.equal(unknownEvidence.success, false)
})

test('uses the documented weighted score and prototype threshold', () => {
  const result = evaluateOpportunity({
    scores: completeScores,
    hardGates: passingGates,
  })

  assert.equal(result.score, 80)
  assert.equal(result.decision, 'prototype-candidate')
  assert.deepEqual(result.blockedGates, [])
  assert.deepEqual(result.unknownGates, [])
  assert.deepEqual(result.missingScoreDimensions, [])
})

test('a blocked hard gate overrides a high opportunity score', () => {
  const result = evaluateOpportunity({
    scores: {
      demandEvidence: 25,
      competitionGap: 20,
      usefulnessDifferentiation: 15,
      marketplaceFit: 15,
      productionFeasibility: 10,
      durability: 10,
      distributionReadiness: 5,
    },
    hardGates: {
      ...passingGates,
      rights: 'blocked',
    },
  })

  assert.equal(result.score, 100)
  assert.equal(result.decision, 'blocked')
  assert.deepEqual(result.blockedGates, ['rights'])
})

test('unknown hard gates prevent prototype promotion', () => {
  const result = evaluateOpportunity({
    scores: completeScores,
    hardGates: {
      ...passingGates,
      payoutFeasibility: 'unknown',
    },
  })

  assert.equal(result.score, 80)
  assert.equal(result.decision, 'research-more')
  assert.deepEqual(result.unknownGates, ['payoutFeasibility'])
})

test('missing score dimensions remain unknown rather than becoming zero', () => {
  const partialScores = { ...completeScores }
  delete partialScores.distributionReadiness
  const result = evaluateOpportunity({
    scores: partialScores,
    hardGates: passingGates,
  })

  assert.equal(result.score, null)
  assert.equal(result.decision, 'research-more')
  assert.deepEqual(result.missingScoreDimensions, ['distributionReadiness'])
})

test('applies the documented research-more and park score bands', () => {
  const researchMore = evaluateOpportunity({
    scores: {
      demandEvidence: 20,
      competitionGap: 15,
      usefulnessDifferentiation: 10,
      marketplaceFit: 10,
      productionFeasibility: 5,
      durability: 5,
      distributionReadiness: 2,
    },
    hardGates: passingGates,
  })
  const park = evaluateOpportunity({
    scores: {
      demandEvidence: 10,
      competitionGap: 10,
      usefulnessDifferentiation: 10,
      marketplaceFit: 10,
      productionFeasibility: 5,
      durability: 5,
      distributionReadiness: 2,
    },
    hardGates: passingGates,
  })

  assert.equal(researchMore.score, 67)
  assert.equal(researchMore.decision, 'research-more')
  assert.equal(park.score, 52)
  assert.equal(park.decision, 'park')
})
