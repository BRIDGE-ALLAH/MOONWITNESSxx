import { z } from 'zod'

const boundedId = z.string().trim().min(1).max(128)
const isoTimestamp = z.string().datetime({ offset: true })

export const decisionProvenanceSchema = z
  .object({
    sourceType: z.enum(['api', 'document', 'event', 'human', 'system']),
    sourceRef: z.string().trim().min(1).max(2048),
    capturedAt: isoTimestamp,
  })
  .strict()

export const decisionGraphNodeSchema = z
  .object({
    id: boundedId,
    kind: z.enum(['decision', 'evidence', 'policy', 'actor', 'action', 'outcome']),
    label: z.string().trim().min(1).max(500),
    createdAt: isoTimestamp,
    provenance: decisionProvenanceSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    validUntil: isoTimestamp.optional(),
  })
  .strict()

export const decisionGraphEdgeSchema = z
  .object({
    id: boundedId,
    from: boundedId,
    to: boundedId,
    relation: z.enum([
      'supports',
      'contradicts',
      'constrained_by',
      'made_by',
      'causes',
      'supersedes',
    ]),
    provenance: decisionProvenanceSchema.optional(),
  })
  .strict()

export const decisionGraphSnapshotSchema = z
  .object({
    id: boundedId,
    version: z.number().int().min(1),
    createdAt: isoTimestamp,
    nodes: z.array(decisionGraphNodeSchema).max(500),
    edges: z.array(decisionGraphEdgeSchema).max(2000),
  })
  .strict()
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>()
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate node id: ${node.id}` })
      }
      nodeIds.add(node.id)
    }
    const edgeIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate edge id: ${edge.id}` })
      }
      edgeIds.add(edge.id)
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        ctx.addIssue({ code: 'custom', message: `Edge ${edge.id} references a missing node` })
      }
    }
  })

export const uncertaintyMetricSchema = z
  .object({
    id: boundedId,
    label: z.string().trim().min(1).max(200),
    low: z.number(),
    base: z.number(),
    high: z.number(),
    unit: z.string().trim().min(1).max(64).optional(),
    sourceQuality: z.enum(['verified', 'estimated', 'missing']),
    missingReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()

export const governanceGateInputSchema = z
  .object({
    metrics: z.array(uncertaintyMetricSchema).max(100),
    requiredEvidenceCount: z.number().int().min(0),
    verifiedEvidenceCount: z.number().int().min(0),
    staleEvidenceCount: z.number().int().min(0),
    contradictionCount: z.number().int().min(0),
    unresolvedAssumptionCount: z.number().int().min(0),
  })
  .strict()

export const scenarioMetricSchema = z
  .object({
    id: boundedId,
    label: z.string().trim().min(1).max(200),
    value: z.number(),
    unit: z.string().trim().min(1).max(64).optional(),
  })
  .strict()

export const scenarioOperationSchema = z
  .object({
    id: boundedId,
    metricId: boundedId,
    operation: z.enum(['set', 'add', 'multiply']),
    operand: z.number(),
    rationale: z.string().trim().min(1).max(500),
  })
  .strict()

export const scenarioDefinitionSchema = z
  .object({
    id: boundedId,
    title: z.string().trim().min(1).max(200),
    basedOnSnapshotId: boundedId,
    assumptions: z.array(z.string().trim().min(1).max(500)).max(50),
    operations: z.array(scenarioOperationSchema).max(200),
  })
  .strict()

/** Wire contract for a persisted Governance Lab snapshot (Headquarter -> ARSY). */
export const governanceSnapshotInputSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    graph: decisionGraphSnapshotSchema,
    gateInput: governanceGateInputSchema,
    scenarioBaseline: z.array(scenarioMetricSchema).min(1).max(100),
    scenario: scenarioDefinitionSchema,
  })
  .strict()
  .superRefine((input, ctx) => {
    const baselineIds = new Set(input.scenarioBaseline.map((metric) => metric.id))
    if (baselineIds.size !== input.scenarioBaseline.length) {
      ctx.addIssue({ code: 'custom', message: 'Scenario baseline metric ids must be unique' })
    }
    const operationIds = new Set<string>()
    for (const operation of input.scenario.operations) {
      if (operationIds.has(operation.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate operation id: ${operation.id}` })
      }
      operationIds.add(operation.id)
      if (!baselineIds.has(operation.metricId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Operation ${operation.id} targets unknown baseline metric: ${operation.metricId}`,
        })
      }
    }
  })

export type GovernanceSnapshotInput = z.infer<typeof governanceSnapshotInputSchema>
export type DecisionGraphSnapshotContract = z.infer<typeof decisionGraphSnapshotSchema>
export type GovernanceGateInputContract = z.infer<typeof governanceGateInputSchema>
export type ScenarioMetricContract = z.infer<typeof scenarioMetricSchema>
export type ScenarioDefinitionContract = z.infer<typeof scenarioDefinitionSchema>

export interface GovernanceSnapshotRecord extends GovernanceSnapshotInput {
  id: string
  ownerId: string
  createdAt: string
  archivedAt: string | null
}

export interface GovernanceSnapshotSummary {
  id: string
  label: string
  createdAt: string
  archivedAt: string | null
}
