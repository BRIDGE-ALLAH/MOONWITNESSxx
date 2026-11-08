import { z } from 'zod'

export const OperatorActionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  danger: z.boolean(),
  requiresConfirmation: z.boolean(),
  target: z.string().min(1),
  category: z.string().min(1),
})

export type OperatorAction = z.infer<typeof OperatorActionSchema>

export const ActionDispatchResultSchema = z.object({
  ok: z.boolean(),
  actionId: z.string().min(1),
  timestamp: z.string().min(1),
  message: z.string(),
  actor: z.string().default('operator'),
  environment: z.string().optional(),
  error: z.string().nullable().optional(),
})

export type ActionDispatchResult = z.infer<typeof ActionDispatchResultSchema>
