import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OracleClientError, type OracleClient } from './client.ts'
import { OracleJobSubmissionSchema } from './contracts.ts'

const JOB_ID_SCHEMA = z.string().uuid()
const IDEMPOTENCY_KEY_SCHEMA = z.string().min(1).max(128)

function sendClientError(error: OracleClientError, reply: FastifyReply) {
  if (error.retryAfter) reply.header('retry-after', error.retryAfter)
  return reply.code(error.status).send({
    error: { code: error.code, message: error.message },
  })
}

export function registerOracleRoutes(app: FastifyInstance, client: OracleClient): void {
  app.post(
    '/api/v1/oracle/jobs',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const payload = OracleJobSubmissionSchema.safeParse(request.body)
      if (!payload.success) {
        return reply.code(422).send({
          error: {
            code: 'INVALID_ORACLE_JOB',
            message: 'The ORACLE job request is invalid or exceeds the supported input limits.',
            details: payload.error.issues.map((issue) => ({
              path: issue.path.map(String),
              code: issue.code,
            })),
          },
        })
      }

      const rawKey = request.headers['idempotency-key']
      if (rawKey !== undefined && typeof rawKey !== 'string') {
        return reply.code(400).send({
          error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'A single Idempotency-Key header is required.' },
        })
      }
      const parsedKey = rawKey === undefined ? undefined : IDEMPOTENCY_KEY_SCHEMA.safeParse(rawKey)
      if (parsedKey && !parsedKey.success) {
        return reply.code(400).send({
          error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must contain 1 to 128 characters.' },
        })
      }

      try {
        const submitted = await client.submitJob(
          payload.data,
          parsedKey?.success ? parsedKey.data : undefined,
        )
        reply.header('location', '/api/v1/oracle/jobs/' + submitted.job.job_id)
        reply.header('idempotency-replayed', String(submitted.replayed))
        return reply.code(202).send({
          data: submitted.job,
          meta: { replayed: submitted.replayed },
        })
      } catch (error) {
        if (error instanceof OracleClientError) return sendClientError(error, reply)
        request.log.error({ err: error }, 'Unexpected ORACLE submission failure')
        return reply.code(502).send({
          error: { code: 'ORACLE_UPSTREAM_ERROR', message: 'ARSY could not complete the request with ORACLE.' },
        })
      }
    },
  )

  app.get('/api/v1/oracle/jobs/:jobId', async (request, reply) => {
    const params = request.params as { jobId?: unknown }
    const jobId = JOB_ID_SCHEMA.safeParse(params.jobId)
    if (!jobId.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_ORACLE_JOB_ID', message: 'A valid ORACLE job UUID is required.' },
      })
    }

    try {
      const job = await client.getJob(jobId.data)
      return { data: job }
    } catch (error) {
      if (error instanceof OracleClientError) return sendClientError(error, reply)
      request.log.error({ err: error }, 'Unexpected ORACLE job lookup failure')
      return reply.code(502).send({
        error: { code: 'ORACLE_UPSTREAM_ERROR', message: 'ARSY could not complete the request with ORACLE.' },
      })
    }
  })
}
