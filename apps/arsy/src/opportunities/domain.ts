import { z } from 'zod'

export const opportunityEvidenceSchema = z.object({
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().max(2048),
  sourceType: z.enum([
    'official-marketplace',
    'public-review',
    'public-community',
    'official-documentation',
    'search-trend',
    'github',
    'other',
  ]),
  capturedAt: z.string().datetime({ offset: true }),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  evidenceClass: z.enum([
    'observed-fact',
    'community-anecdote',
    'inference',
    'hypothesis',
    'unknown',
  ]),
  summary: z.string().trim().min(1).max(2000),
  reliability: z.enum(['high', 'medium', 'low', 'unknown']),
  collectionMethod: z.string().trim().min(1).max(300),
  permissionBasis: z.string().trim().min(1).max(500),
  recheckAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export const opportunityScoreSchema = z.object({
  demandEvidence: z.number().min(0).max(25).optional(),
  competitionGap: z.number().min(0).max(20).optional(),
  usefulnessDifferentiation: z.number().min(0).max(15).optional(),
  marketplaceFit: z.number().min(0).max(15).optional(),
  productionFeasibility: z.number().min(0).max(10).optional(),
  durability: z.number().min(0).max(10).optional(),
  distributionReadiness: z.number().min(0).max(5).optional(),
})

export const opportunityHardGatesSchema = z.object({
  rights: z.enum(['pass', 'blocked', 'unknown']),
  countryEligibility: z.enum(['pass', 'blocked', 'unknown']),
  channelPolicy: z.enum(['pass', 'blocked', 'unknown']),
  payoutFeasibility: z.enum(['pass', 'blocked', 'unknown']),
})

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(3).max(180),
  buyerProblem: z.string().trim().min(10).max(3000),
  buyerSegment: z.string().trim().min(2).max(300),
  jobToBeDone: z.string().trim().min(5).max(1000),
  productHypothesis: z.string().trim().min(5).max(2000),
  productFamily: z.enum([
    'digital-utility',
    'stock-asset',
    'affiliate-media',
    'publishing',
    'workflow-product',
    'media',
    'game-asset',
    'microgame',
  ]),
  candidateChannels: z.array(z.string().trim().min(1).max(120)).max(20),
  evidence: z.array(opportunityEvidenceSchema).min(1).max(100),
  scores: opportunityScoreSchema,
  hardGates: opportunityHardGatesSchema,
})

export type OpportunityInput = z.infer<typeof opportunityInputSchema>

const scoreWeights = {
  demandEvidence: 25,
  competitionGap: 20,
  usefulnessDifferentiation: 15,
  marketplaceFit: 15,
  productionFeasibility: 10,
  durability: 10,
  distributionReadiness: 5,
} as const

export type OpportunityDecision =
  | 'blocked'
  | 'research-more'
  | 'prototype-candidate'
  | 'park'

export interface OpportunityEvaluation {
  score: number | null
  decision: OpportunityDecision
  blockedGates: string[]
  unknownGates: string[]
  missingScoreDimensions: string[]
}

/**
 * Apply the approved docs/05 opportunity score and hard-gate precedence.
 * Missing score dimensions remain unknown; they are never silently scored as zero.
 */
export function evaluateOpportunity(input: Pick<OpportunityInput, 'scores' | 'hardGates'>): OpportunityEvaluation {
  const gateEntries = Object.entries(input.hardGates)
  const blockedGates = gateEntries.filter(([, value]) => value === 'blocked').map(([key]) => key)
  const unknownGates = gateEntries.filter(([, value]) => value === 'unknown').map(([key]) => key)
  const scoreEntries = Object.entries(scoreWeights) as Array<[keyof typeof scoreWeights, number]>
  const missingScoreDimensions = scoreEntries
    .filter(([key]) => input.scores[key] === undefined)
    .map(([key]) => key)
  const scoreIsComplete = missingScoreDimensions.length === 0
  const score = scoreIsComplete
    ? Math.round(scoreEntries.reduce((total, [key]) => total + (input.scores[key] ?? 0), 0) * 100) / 100
    : null

  let decision: OpportunityDecision
  if (blockedGates.length > 0) {
    decision = 'blocked'
  } else if (unknownGates.length > 0 || score === null) {
    decision = 'research-more'
  } else if (score >= 80) {
    decision = 'prototype-candidate'
  } else if (score >= 65) {
    decision = 'research-more'
  } else {
    decision = 'park'
  }

  return {
    score,
    decision,
    blockedGates,
    unknownGates,
    missingScoreDimensions,
  }
}
