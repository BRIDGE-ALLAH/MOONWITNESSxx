import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'

const inputSchema = z.object({
  action: z.enum(['attempt', 'failure', 'success']),
  networkHash: z.string().regex(/^[a-f0-9]{64}$/),
})

type QueryResult<T> = { rows: T[] }

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

function retryAfter(result: unknown): number {
  return Math.max(0, rows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0)
}

/**
 * Shared PostgreSQL login limiter. "attempt" reserves one verification slot before
 * password KDF work, preventing concurrent requests from all passing a read-only check.
 */
export function registerLoginAttemptRoutes(
  app: FastifyInstance,
  db: DatabasePool,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''

  app.post('/api/v1/auth/login-attempts', async (request, reply) => {
    const parsed = inputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Login-attempt input is invalid.' } })
    }
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })

    const { action, networkHash } = parsed.data
    const bucketKeys = ['account', `network:${networkHash}`]

    await db.query(
      "DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND updated_at < now() - interval '1 day'",
      [ownerId],
    )

    if (action === 'success') {
      await db.query(
        'DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND bucket_key = ANY($2::text[])',
        [ownerId, bucketKeys],
      )
      return { data: { allowed: true, retryAfterSeconds: 0 } }
    }

    if (action === 'failure') {
      const result = await db.query(
        `WITH blocked AS (
          UPDATE arsy_login_attempt_buckets
          SET blocked_until = CASE
                WHEN blocked_until > now() THEN blocked_until
                ELSE now() + interval '15 minutes'
              END,
              updated_at = now()
          WHERE owner_id = $1
            AND bucket_key = ANY($2::text[])
            AND attempt_count >= 5
          RETURNING blocked_until
        )
        SELECT COALESCE(MAX(CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))), 0)::int AS retry_after_seconds
        FROM blocked
        WHERE blocked_until > now()`,
        [ownerId, bucketKeys],
      )
      const retryAfterSeconds = retryAfter(result)
      return { data: { allowed: retryAfterSeconds === 0, retryAfterSeconds } }
    }

    const result = await db.query(
      `WITH keys AS (
        SELECT unnest($2::text[]) AS bucket_key
      ), upserted AS (
        INSERT INTO arsy_login_attempt_buckets AS existing_bucket
          (owner_id, bucket_key, window_started_at, attempt_count, blocked_until, updated_at)
        SELECT $1, keys.bucket_key, now(), 1, NULL, now()
        FROM keys
        ON CONFLICT (owner_id, bucket_key) DO UPDATE SET
          window_started_at = CASE
            WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN now()
            ELSE existing_bucket.window_started_at
          END,
          attempt_count = CASE
            WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN 1
            ELSE LEAST(existing_bucket.attempt_count + 1, 5)
          END,
          blocked_until = CASE
            WHEN existing_bucket.blocked_until > now() THEN existing_bucket.blocked_until
            WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN NULL
            WHEN existing_bucket.attempt_count >= 5 THEN now() + interval '15 minutes'
            ELSE NULL
          END,
          updated_at = now()
        RETURNING blocked_until
      )
      SELECT COALESCE(MAX(CEIL(EXTRACT(EPOCH FROM (blocked_until - now()))), 0), 0)::int AS retry_after_seconds
      FROM upserted
      WHERE blocked_until > now()`,
      [ownerId, bucketKeys],
    )
    const retryAfterSeconds = retryAfter(result)
    return { data: { allowed: retryAfterSeconds === 0, retryAfterSeconds } }
  })
}
