import { z } from 'zod'
import { httpUrlSchema } from '../http-url.ts'

export const opportunityEvidenceSchema = z.object({
  evidenceId: z.string().trim().min(1).max(120),
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: httpUrlSchema,
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
  limitations: z.string().trim().min(1).max(1000),
  collectionMethod: z.string().trim().min(1).max(300),
  permissionBasis: z.string().trim().min(1).max(500),
  recheckAt: z.string().datetime({ offset: true }).nullable().optional(),
})

const scoreDimensionSchema = z.object({
  rationale: z.string().trim().min(10).max(1000),
  confidence: z.enum(['high', 'medium', 'low', 'unknown']),
  evidenceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
})

const gateDetailSchema = z.object({
  status: z.enum(['pass', 'blocked', 'unknown']),
  rationale: z.string().trim().min(5).max(1000),
  evidenceIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
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

const dimensionNames = [
  'demandEvidence',
  'competitionGap',
  'usefulnessDifferentiation',
  'marketplaceFit',
  'productionFeasibility',
  'durability',
  'distributionReadiness',
] as const

const gateNames = ['rights', 'countryEligibility', 'channelPolicy', 'payoutFeasibility'] as const

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
  scoreDetails: z.object({
    demandEvidence: scoreDimensionSchema.optional(),
    competitionGap: scoreDimensionSchema.optional(),
    usefulnessDifferentiation: scoreDimensionSchema.optional(),
    marketplaceFit: scoreDimensionSchema.optional(),
    productionFeasibility: scoreDimensionSchema.optional(),
    durability: scoreDimensionSchema.optional(),
    distributionReadiness: scoreDimensionSchema.optional(),
  }),
  hardGates: opportunityHardGatesSchema,
  hardGateDetails: z.object({
    rights: gateDetailSchema,
    countryEligibility: gateDetailSchema,
    channelPolicy: gateDetailSchema,
    payoutFeasibility: gateDetailSchema,
  }),
}).superRefine((input, context) => {
  const evidenceIds = new Set(input.evidence.map((item) => item.evidenceId))
  if (evidenceIds.size !== input.evidence.length) {
    context.addIssue({ code: 'custom', path: ['evidence'], message: 'Evidence IDs must be unique.' })
  }

  for (const dimension of dimensionNames) {
    const score = input.scores[dimension]
    const detail = input.scoreDetails[dimension]
    if (score !== undefined && !detail) {
      context.addIssue({ code: 'custom', path: ['scoreDetails', dimension], message: 'A scored dimension requires rationale, confidence, and evidence references.' })
    }
    for (const evidenceId of detail?.evidenceIds ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({ code: 'custom', path: ['scoreDetails', dimension, 'evidenceIds'], message: `Unknown evidence reference: ${evidenceId}` })
      }
    }
  }

  for (const gate of gateNames) {
    const detail = input.hardGateDetails[gate]
    if (detail.status !== input.hardGates[gate]) {
      context.addIssue({ code: 'custom', path: ['hardGateDetails', gate, 'status'], message: 'Gate detail status must match the gate decision.' })
    }
    if (detail.status !== 'unknown' && detail.evidenceIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['hardGateDetails', gate, 'evidenceIds'],
        message: 'A passed or blocked hard gate requires at least one supporting evidence reference.',
      })
    }
    for (const evidenceId of detail.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({ code: 'custom', path: ['hardGateDetails', gate, 'evidenceIds'], message: `Unknown evidence reference: ${evidenceId}` })
      }
    }
  }
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
    ? Math.round(scoreEntries.reduce((total, [key, weight]) => total + (input.scores[key] ?? 0), 0) * 100) / 100
    : null

  let decision: OpportunityDecision
  if (blockedGates.length > 0) decision = 'blocked'
  else if (unknownGates.length > 0 || score === null) decision = 'research-more'
  else if (score >= 80) decision = 'prototype-candidate'
  else if (score >= 65) decision = 'research-more'
  else decision = 'park'

  return { score, decision, blockedGates, unknownGates, missingScoreDimensions }
}
