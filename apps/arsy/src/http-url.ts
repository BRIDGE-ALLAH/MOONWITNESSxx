import { z } from 'zod'

/**
 * Canonical external references used for evidence, provenance and receipts.
 * These values may be rendered as links; executable, local and credential-bearing
 * URL schemes must never enter persisted product records.
 */
export const httpEvidenceUrlSchema = z.string()
  .trim()
  .max(2048)
  .url()
  .superRefine((value, context) => {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        message: 'Evidence URLs must use HTTP or HTTPS.',
      })
    }

    if (parsed.username || parsed.password) {
      context.addIssue({
        code: 'custom',
        message: 'Evidence URLs must not contain embedded credentials.',
      })
    }
  })
