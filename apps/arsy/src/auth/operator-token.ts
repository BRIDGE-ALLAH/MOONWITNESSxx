import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'

type OperatorRequest = {
  headers: Record<string, string | string[] | undefined>
}
const inspectionPrincipals = new WeakMap<object, string>()

/** Constant-time comparison for the private service-to-service operator credential. */
export function hasValidOperatorToken(request: OperatorRequest, token: string | undefined): boolean {
  if (!token) return false
  const supplied = request.headers['x-arsy-operator-token']
  if (typeof supplied !== 'string') return false
  const expected = Buffer.from(token)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function parseInspectionPrincipals(env: NodeJS.ProcessEnv): Map<string, string> {
  const raw = env.ARSY_INSPECTION_PRINCIPALS?.trim()
  if (!raw) return new Map()
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    throw new Error('ARSY_INSPECTION_PRINCIPALS must be a JSON object of principal IDs to tokens.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ARSY_INSPECTION_PRINCIPALS must be a JSON object of principal IDs to tokens.')
  }
  const principals = new Map<string, string>()
  for (const [id, token] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[a-z0-9][a-z0-9:_-]{2,79}$/i.test(id) || typeof token !== 'string' || token.length < 32) {
      throw new Error('Each inspection principal needs a valid ID and a token of at least 32 characters.')
    }
    principals.set(id, token)
  }
  return principals
}

function hasValidInspectionPrincipal(request: OperatorRequest, principals: Map<string, string>): string | null {
  const pathname = request.headers['x-forwarded-path']
  void pathname
  const id = request.headers['x-arsy-inspector-id']
  const token = request.headers['x-arsy-inspector-token']
  if (typeof id !== 'string' || typeof token !== 'string') return null
  const expectedToken = principals.get(id)
  if (!expectedToken) return null
  const expected = Buffer.from(expectedToken)
  const actual = Buffer.from(token)
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null
}

/** Trusted inspection principals are restricted to the asset inspection write route. */
export function getInspectionPrincipalId(request: FastifyRequest): string | null {
  return inspectionPrincipals.get(request) ?? null
}

/** Protect every versioned business API consistently; health and liveness remain public. */
export function registerOperatorApiAuth(app: FastifyInstance, env: NodeJS.ProcessEnv = process.env): void {
  const token = env.ARSY_OPERATOR_TOKEN?.trim()
  const operatorId = env.ARSY_OPERATOR_ID?.trim()
  const principals = parseInspectionPrincipals(env)
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
    const isInspectionWrite = request.method === 'POST' && /^\/api\/v1\/assets\/[0-9a-f-]+\/inspections(?:\?|$)/i.test(request.url)
    if (isInspectionWrite) {
      const principalId = hasValidInspectionPrincipal(request, principals)
      if (principalId) {
        inspectionPrincipals.set(request, principalId)
        return
      }
    }
    if (!hasValidOperatorToken(request, token)) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid operator or route-scoped inspection credentials are required.',
        },
      })
    }
  })
}
