import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
const bucketHashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const bucketSchema = z.object({
  operatorBucketHash: bucketHashSchema,
  networkBucketHash: bucketHashSchema,
}).strict()

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

export class LoginAttemptRepository {
  constructor(private readonly db: DatabasePool) {}

  async check(operatorBucketHash: string, networkBucketHash: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(CEIL(EXTRACT(EPOCH FROM (MAX(blocked_until) - now()))), 0)::integer AS retry_after_seconds
       FROM arsy_login_attempt_buckets
       WHERE ((bucket_type = 'operator' AND bucket_hash = $1)
          OR (bucket_type = 'network' AND bucket_hash = $2))
         AND blocked_until > now()`,
      [operatorBucketHash, networkBucketHash],
    )
    return Math.max(0, Number(rows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0))
  }

  async recordFailure(operatorBucketHash: string, networkBucketHash: string): Promise<number> {
    const result = await this.db.query(
      `WITH input(bucket_type, bucket_hash) AS (
         SELECT 'operator'::text, $1::char(64)
         UNION ALL SELECT 'network'::text, $2::char(64)
       ), upserted AS (
         INSERT INTO arsy_login_attempt_buckets AS current
           (bucket_type, bucket_hash, window_started_at, failure_count, updated_at)
         SELECT bucket_type, bucket_hash, now(), 1, now() FROM input
         ON CONFLICT (bucket_type, bucket_hash) DO UPDATE SET
           failure_count = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes'
               OR (current.blocked_until IS NOT NULL AND current.blocked_until <= now()) THEN 1
             ELSE current.failure_count + 1
           END,
           window_started_at = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes'
               OR (current.blocked_until IS NOT NULL AND current.blocked_until <= now()) THEN now()
             ELSE current.window_started_at
           END,
           blocked_until = CASE
             WHEN (CASE
               WHEN current.window_started_at <= now() - interval '15 minutes'
                 OR (current.blocked_until IS NOT NULL AND current.blocked_until <= now()) THEN 1
               ELSE current.failure_count + 1
             END) >= 5
             THEN now() + interval '15 minutes'
             ELSE NULL
           END,
           updated_at = now()
         RETURNING blocked_until
       )
       SELECT COALESCE(CEIL(EXTRACT(EPOCH FROM (MAX(blocked_until) - now()))), 0)::integer AS retry_after_seconds
       FROM upserted WHERE blocked_until > now()`,
      [operatorBucketHash, networkBucketHash],
    )
    return Math.max(0, Number(rows<{ retry_after_seconds: number }>(result)[0]?.retry_after_seconds ?? 0))
  }

  async clear(operatorBucketHash: string, networkBucketHash: string): Promise<void> {
    await this.db.query(
      `DELETE FROM arsy_login_attempt_buckets
       WHERE (bucket_type = 'operator' AND bucket_hash = $1)
          OR (bucket_type = 'network' AND bucket_hash = $2)`,
      [operatorBucketHash, networkBucketHash],
    )
  }
}

export function registerLoginAttemptRoutes(app: FastifyInstance, db: DatabasePool): void {
  const repository = new LoginAttemptRepository(db)
  app.post('/api/v1/auth/login-attempts/check', async (request, reply) => {
    const parsed = bucketSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_LOGIN_LIMITER_KEYS' } })
    const retryAfterSeconds = await repository.check(parsed.data.operatorBucketHash, parsed.data.networkBucketHash)
    return { data: { blocked: retryAfterSeconds > 0, retryAfterSeconds } }
  })
  app.post('/api/v1/auth/login-attempts/failure', async (request, reply) => {
    const parsed = bucketSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_LOGIN_LIMITER_KEYS' } })
    const retryAfterSeconds = await repository.recordFailure(parsed.data.operatorBucketHash, parsed.data.networkBucketHash)
    return { data: { blocked: retryAfterSeconds > 0, retryAfterSeconds } }
  })
  app.post('/api/v1/auth/login-attempts/success', async (request, reply) => {
    const parsed = bucketSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_LOGIN_LIMITER_KEYS' } })
    await repository.clear(parsed.data.operatorBucketHash, parsed.data.networkBucketHash)
    return { data: { cleared: true } }
  })
}
