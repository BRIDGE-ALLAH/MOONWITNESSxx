import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

export type LoginLimitAction = 'check' | 'failure' | 'success'

export interface LoginLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Only trust one canonical client IP from a configured ingress. The ingress must
 * overwrite X-Forwarded-For and direct access to Headquarter must be blocked.
 * In local/test mode, forwarded headers are ignored unless explicitly configured.
 */
export function resolveLoginNetworkHash(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = env.HEADQUARTER_SESSION_SECRET?.trim()
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null

  let networkIdentity = 'local-development-network'
  if (env.NODE_ENV === 'production') {
    if (env.HEADQUARTER_TRUSTED_PROXY_HOPS !== '1') return null
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (!forwarded || forwarded.includes(',') || isIP(forwarded) === 0) return null
    networkIdentity = forwarded
  } else if (env.HEADQUARTER_TRUSTED_PROXY_HOPS === '1') {
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (forwarded && !forwarded.includes(',') && isIP(forwarded) !== 0) {
      networkIdentity = forwarded
    }
  }

  // HMAC prevents a database reader from reversing common IPv4/IPv6 values
  // through a precomputed SHA-256 lookup. The raw address is never persisted.
  return createHmac('sha256', secret)
    .update('moonwitness-login-network-v1:')
    .update(networkIdentity)
    .digest('hex')
}

export async function requestSharedLoginLimit(
  request: Request,
  action: LoginLimitAction,
  env: NodeJS.ProcessEnv = process.env,
): Promise<LoginLimitResult> {
  const networkHash = resolveLoginNetworkHash(request, env)
  const baseUrl = env.ARSY_API_BASE_URL?.trim()
  const operatorToken = env.ARSY_OPERATOR_TOKEN?.trim()
  if (!networkHash || !baseUrl || !operatorToken) {
    throw new Error('SHARED_LOGIN_LIMIT_NOT_CONFIGURED')
  }

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
  if (
    typeof payload.data?.allowed !== 'boolean' ||
    typeof payload.data.retryAfterSeconds !== 'number' ||
    !Number.isSafeInteger(payload.data.retryAfterSeconds) ||
    payload.data.retryAfterSeconds < 0
  ) {
    throw new Error('SHARED_LOGIN_LIMIT_INVALID_RESPONSE')
  }
  return {
    allowed: payload.data.allowed,
    retryAfterSeconds: payload.data.retryAfterSeconds,
  }
}
