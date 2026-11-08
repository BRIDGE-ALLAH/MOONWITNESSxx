import { z } from 'zod'

export const OracleEvidenceRefSchema = z.object({
  ref: z.string().min(1).max(256),
  relation: z.string().min(1).max(64).default('wasDerivedFrom'),
}).strict()

const StatisticsJobSchema = z.object({
  task_type: z.literal('statistics.describe'),
  input: z.object({
    values: z.array(z.number().finite()).min(1).max(10_000),
    label: z.string().max(160).nullable().optional(),
  }).strict(),
  evidence: z.array(OracleEvidenceRefSchema).max(100).optional(),
}).strict()

const TextProfileJobSchema = z.object({
  task_type: z.literal('text.profile'),
  input: z.object({
    text: z.string().min(1).max(100_000),
    language_hint: z.string().min(2).max(32).nullable().optional(),
  }).strict(),
  evidence: z.array(OracleEvidenceRefSchema).max(100).optional(),
}).strict()

export const OracleJobSubmissionSchema = z.discriminatedUnion('task_type', [
  StatisticsJobSchema,
  TextProfileJobSchema,
])

const OracleJobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed'])

const OracleJobErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
}).strict()

const OracleProvenanceSchema = z.object({
  method_id: z.string(),
  method_version: z.string(),
  engine: z.literal('ORACLE'),
  engine_version: z.string(),
  digest_algorithm: z.literal('sha-256'),
  input_digest: z.string().regex(/^[a-f0-9]{64}$/),
  output_digest: z.string().regex(/^[a-f0-9]{64}$/),
  evidence: z.array(OracleEvidenceRefSchema),
  completed_at: z.string().datetime({ offset: true }),
  limitations: z.array(z.string()),
}).strict()

export const OracleJobViewSchema = z.object({
  job_id: z.string().uuid(),
  task_type: z.enum(['statistics.describe', 'text.profile']),
  status: OracleJobStatusSchema,
  submitted_at: z.string().datetime({ offset: true }),
  started_at: z.string().datetime({ offset: true }).nullable().optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  error: OracleJobErrorSchema.nullable().optional(),
  provenance: OracleProvenanceSchema.nullable().optional(),
}).strict()

export const OracleJobSubmissionResponseSchema = z.object({
  job: OracleJobViewSchema,
  replayed: z.boolean(),
}).strict()

export type OracleJobSubmission = z.infer<typeof OracleJobSubmissionSchema>
export type OracleJobView = z.infer<typeof OracleJobViewSchema>
export type OracleJobSubmissionResponse = z.infer<typeof OracleJobSubmissionResponseSchema>
