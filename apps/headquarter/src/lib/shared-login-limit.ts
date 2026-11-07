import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

export type LoginLimitAction = 'check' | 'failure' | 'success'

export interface LoginLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Only trust a single canonical client IP supplied by a configured ingress.
 * The ingress must overwrite X-Forwarded-For and direct app access must be blocked.
 * In local/test mode, forwarded headers are ignored.
 */
export function resolveLoginNetworkHash(request: Request, env: NodeJS.ProcessEnv = process.env): string | null {
  const hops = Number(env.HEADQUARTER_TRUSTED_PROXY_HOPS)
  if (env.NODE_ENV === 'production') {
    if (hops !== 1) return null
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (!forwarded || forwarded.includes(',')) return null
    const address = forwarded.trim()
    if (isIP(address) === 0) return null
    return createHash('sha256').update(address).digest('hex')
  }

  if (hops === 1) {
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (forwarded && !forwarded.includes(',') && isIP(forwarded)) {
      return createHash('sha256').update(forwarded).digest('hex')
    }
  }
  return createHash('sha256').update('local-development-network').digest('hex')
}

export async function requestSharedLoginLimit(
  request: Request,
  action: LoginLimitAction,
  env: NodeJS.ProcessEnv = process.env,
): Promise<LoginLimitResult> {
  const networkHash = resolveLoginNetworkHash(request, env)
  const baseUrl = env.ARSY_API_BASE_URL?.trim()
  const operatorToken = env.ARSY_OPERATOR_TOKEN?.trim()
  if (!networkHash || !baseUrl || !operatorToken) throw new Error('SHARED_LOGIN_LIMIT_NOT_CONFIGURED')

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/auth/login-attempts`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-arsy-operator-token': operatorToken,
    },
    body: JSON.stringify({ action, networkHash }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error('SHARED_LOGIN_LIMIT_UNAVAILABLE')
  const payload = await response.json() as { data?: Partial<LoginLimitResult> }
  if (typeof payload.data?.allowed !== 'boolean' ||
      typeof payload.data.retryAfterSeconds !== 'number' ||
      !Number.isSafeInteger(payload.data.retryAfterSeconds) ||
      payload.data.retryAfterSeconds < 0) {
    throw new Error('SHARED_LOGIN_LIMIT_INVALID_RESPONSE')
  }
  return { allowed: payload.data.allowed, retryAfterSeconds: payload.data.retryAfterSeconds }
}
