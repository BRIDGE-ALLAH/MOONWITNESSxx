import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { getArsyOperatorPrincipal } from './operator-token.ts'
import type { DatabasePool } from '../db.ts'

const inputSchema = z.object({
  action: z.enum(['attempt', 'success']),
  networkHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

type QueryResult<T> = { rows: T[] }

function queryRows<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as QueryResult<T>).rows)) {
    throw new Error('Login-attempt database query returned an invalid result')
  }
  return (value as QueryResult<T>).rows
}

/**
 * Persist account-wide and HMAC-derived network buckets in one PostgreSQL
 * statement. Reserving an attempt before password verification makes the
 * limit effective even when multiple Headquarter replicas receive requests
 * concurrently. The sixth attempt in a 15-minute window is rejected.
 */
export function registerLoginAttemptRoutes(app: FastifyInstance, db: DatabasePool): void {
  app.post('/api/v1/auth/login-attempts', async (request, reply) => {
    const principal = getArsyOperatorPrincipal(request)
    if (!principal) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    }

    const parsed = inputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Login-attempt input is invalid.' },
      })
    }

    const ownerId = principal.operatorId.trim()
    if (!ownerId || ownerId.length > 128) {
      return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })
    }

    const { action, networkHash } = parsed.data
    const bucketKeys = ['account', `network:${networkHash}`]

    try {
      if (action === 'success') {
        await db.query(
          'DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND bucket_key = ANY($2::text[])',
          [ownerId, bucketKeys],
        )
        return { data: { allowed: true, retryAfterSeconds: 0 } }
      }

      // This single upsert serializes attempts on both bucket rows. A caller
      // cannot race a separate check request across application instances.
      const result = await db.query(
        `WITH keys AS (
           SELECT unnest($2::text[]) AS bucket_key
         ),
         upserted AS (
           INSERT INTO arsy_login_attempt_buckets AS existing_bucket
             (owner_id, bucket_key, window_started_at, attempt_count, blocked_until, updated_at)
           SELECT $1, keys.bucket_key, now(), 1, NULL, now()
           FROM keys
           ORDER BY keys.bucket_key
           ON CONFLICT (owner_id, bucket_key) DO UPDATE SET
             window_started_at = CASE
               WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN now()
               ELSE existing_bucket.window_started_at
             END,
             attempt_count = CASE
               WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN 1
               WHEN existing_bucket.blocked_until > now() THEN existing_bucket.attempt_count
               ELSE LEAST(existing_bucket.attempt_count + 1, 6)
             END,
             blocked_until = CASE
               WHEN existing_bucket.window_started_at <= now() - interval '15 minutes' THEN NULL
               WHEN existing_bucket.blocked_until > now() THEN existing_bucket.blocked_until
               WHEN existing_bucket.attempt_count + 1 > 5 THEN now() + interval '15 minutes'
               ELSE NULL
             END,
             updated_at = now()
           RETURNING blocked_until
         )
         SELECT COALESCE(
           MAX(CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))),
           0
         )::int AS retry_after_seconds
         FROM upserted
         WHERE blocked_until > now()`,
        [ownerId, bucketKeys],
      )
      const retryAfterSeconds = Math.max(
        0,
        Number(queryRows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0),
      )
      return {
        data: {
          allowed: retryAfterSeconds === 0,
          retryAfterSeconds,
        },
      }
    } catch {
      // Never leak SQL errors or database details through the authentication API.
      return reply.code(503).send({ error: { code: 'LOGIN_LIMIT_UNAVAILABLE' } })
    }
  })
}
