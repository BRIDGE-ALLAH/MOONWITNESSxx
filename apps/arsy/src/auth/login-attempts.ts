import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'

const inputSchema = z.object({
  action: z.enum(['check', 'failure', 'success']),
  networkHash: z.string().regex(/^[a-f0-9]{64}$/),
})

type QueryResult<T> = { rows: T[] }

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

/** Shared PostgreSQL login throttle: account-wide and trusted-network buckets. */
export function registerLoginAttemptRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''

  app.post('/api/v1/auth/login-attempts', async (request, reply) => {
    const parsed = inputSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Login-attempt input is invalid.' } })
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })

    const { action, networkHash } = parsed.data
    const bucketKeys = ['account', `network:${networkHash}`]

    if (action === 'check') {
      const result = await db.query(
        `SELECT COALESCE(MAX(CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))), 0)::int AS retry_after_seconds
         FROM arsy_login_attempt_buckets
         WHERE owner_id = $1 AND bucket_key = ANY($2::text[]) AND blocked_until > now()`,
        [ownerId, bucketKeys],
      )
      const retryAfterSeconds = Math.max(0, rows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0)
      return { data: { allowed: retryAfterSeconds === 0, retryAfterSeconds } }
    }

    if (action === 'success') {
      await db.query(
        'DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND bucket_key = ANY($2::text[])',
        [ownerId, bucketKeys],
      )
      return { data: { allowed: true, retryAfterSeconds: 0 } }
    }

    const result = await db.query(
      `WITH keys AS (
        SELECT unnest($2::text[]) AS bucket_key
      ), upserted AS (
        INSERT INTO arsy_login_attempt_buckets AS existing_bucket
          (owner_id, bucket_key, window_started_at, failure_count, blocked_until, updated_at)
        SELECT $1, keys.bucket_key, now(), 1, NULL, now()
        FROM keys
        ON CONFLICT (owner_id, bucket_key) DO UPDATE SET
          window_started_at = CASE
            WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN now()
            ELSE existing_bucket.window_started_at
          END,
          failure_count = CASE
            WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN 1
            ELSE existing_bucket.failure_count + 1
          END,
          blocked_until = CASE
            WHEN (CASE
              WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN 1
              ELSE existing_bucket.failure_count + 1
            END) >= 5 THEN now() + interval '15 minutes'
            ELSE NULL
          END,
          updated_at = now()
        RETURNING blocked_until
      )
      SELECT COALESCE(MAX(CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))), 0)::int AS retry_after_seconds
      FROM upserted
      WHERE blocked_until > now()`,
      [ownerId, bucketKeys],
    )
    const retryAfterSeconds = Math.max(0, rows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0)
    return { data: { allowed: retryAfterSeconds === 0, retryAfterSeconds } }
  })
}
