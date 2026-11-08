import { z } from 'zod'

export const ProbeTelemetrySchema = z.object({
  status: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']),
  latencyMs: z.number().nonnegative(),
  target: z.string().min(1),
  ok: z.boolean(),
  error: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
})

export type ProbeTelemetry = z.infer<typeof ProbeTelemetrySchema>

export const NodeTelemetrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['core', 'data', 'edge', 'auth']),
  status: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']),
  latencyMs: z.number().nonnegative(),
  uptime: z.string().nullable().optional(),
  load: z.string().nullable().optional(),
  probe: ProbeTelemetrySchema,
  source: z.string().min(1),
  timestamp: z.string().min(1),
})

export type NodeTelemetry = z.infer<typeof NodeTelemetrySchema>

export const CockpitSnapshotSchema = z.object({
  timestamp: z.string().min(1),
  environment: z.enum(['local', 'staging', 'production']),
  targetHost: z.string().min(1),
  probe: ProbeTelemetrySchema,
  nodes: z.array(NodeTelemetrySchema),
  recentLogs: z.array(z.record(z.string(), z.any())).optional().default([]),
  source: z.string().min(1),
})

export type CockpitSnapshot = z.infer<typeof CockpitSnapshotSchema>
