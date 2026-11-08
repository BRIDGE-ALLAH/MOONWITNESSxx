import { z } from 'zod'

export const UniverseExperienceSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  name: z.string().min(1),
  classification: z.string().min(1),
  role: z.string().min(1),
  status: z.enum(['active', 'degraded', 'offline', 'target']),
  statusLabel: z.string().optional(),
  boundary: z.string().min(1),
  href: z.string().optional(),
})

export type UniverseExperience = z.infer<typeof UniverseExperienceSchema>
