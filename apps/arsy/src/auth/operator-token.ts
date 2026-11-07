import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'

type OperatorRequest = {
  headers: Record<string, string | string[] | undefined>
}

/** Constant-time comparison for the private service-to-service operator credential. */
export function hasValidOperatorToken(request: OperatorRequest, token: string | undefined): boolean {
  if (!token) return false
  const supplied = request.headers['x-arsy-operator-token']
  if (typeof supplied !== 'string') return false
  const expected = Buffer.from(token)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Protect every versioned business API consistently; health and liveness remain public. */
export function registerOperatorApiAuth(app: FastifyInstance, env: NodeJS.ProcessEnv = process.env): void {
  const token = env.ARSY_OPERATOR_TOKEN?.trim()
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/v1/')) return
    if (!hasValidOperatorToken(request, token)) {
      return reply.code(token ? 401 : 503).send({
        error: {
          code: token ? 'UNAUTHORIZED' : 'OPERATOR_AUTH_NOT_CONFIGURED',
          message: token ? 'Valid operator credentials are required.' : 'Operator authentication is not configured.',
        },
      })
    }
  })
}
