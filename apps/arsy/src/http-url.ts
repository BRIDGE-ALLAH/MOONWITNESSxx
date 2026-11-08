import { z } from 'zod'

/** Canonical externally supplied evidence/provenance links. This schema validates only; it never fetches URLs. */
export const httpUrlSchema = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username.length === 0 && url.password.length === 0
  } catch {
    return false
  }
}, 'URL must be an absolute HTTP(S) URL without embedded credentials.')
