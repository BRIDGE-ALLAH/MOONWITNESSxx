import { z } from 'zod'

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  type: z.string().min(1),
  actionId: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  environment: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
})

export type AuditEvent = z.infer<typeof AuditEventSchema>
