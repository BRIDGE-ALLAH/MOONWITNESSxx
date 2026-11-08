import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'

export interface ArsyOperatorPrincipal {
  kind: 'operator'
  operatorId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    arsyPrincipal: ArsyOperatorPrincipal | null
  }
}

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
  const operatorId = env.ARSY_OPERATOR_ID?.trim()
  app.decorateRequest('arsyPrincipal', null)
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/v1/')) return
    if (!token || !operatorId) {
      return reply.code(503).send({
        error: {
          code: 'OPERATOR_AUTH_NOT_CONFIGURED',
          message: 'A deliberate operator identity and server-side operator token are required.',
        },
      })
    }
    if (!hasValidOperatorToken(request, token)) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid operator credentials are required.',
        },
      })
    }
    request.arsyPrincipal = { kind: 'operator', operatorId }
  })
}

/** Return only the principal established by the authenticated request hook. */
export function getArsyOperatorPrincipal(request: FastifyRequest): ArsyOperatorPrincipal | null {
  return request.arsyPrincipal ?? null
}
