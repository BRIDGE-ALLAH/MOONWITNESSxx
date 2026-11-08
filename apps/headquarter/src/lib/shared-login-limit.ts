import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

export type LoginLimitAction = 'attempt' | 'failure' | 'success'

export interface LoginLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

function canonicalIp(address: string): string | null {
  const version = isIP(address)
  if (version === 4) return address
  if (version !== 6) return null
  try {
    return new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase()
  } catch {
    return null
  }
}

function hashNetwork(address: string, secret: string): string {
  return createHmac('sha256', secret).update('moonwitness-login-network-v1:').update(address).digest('hex')
}

/** Trust exactly one ingress that overwrites X-Forwarded-For; direct access must be blocked. */
export function resolveLoginNetworkHash(request: Request, env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.HEADQUARTER_SESSION_SECRET?.trim()
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  const trustedSingleProxy = env.HEADQUARTER_TRUSTED_PROXY_HOPS === '1'

  if (env.NODE_ENV === 'production') {
    if (!trustedSingleProxy) return null
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (!forwarded || forwarded.includes(',')) return null
    const address = canonicalIp(forwarded)
    return address ? hashNetwork(address, secret) : null
  }

  if (trustedSingleProxy) {
    const forwarded = request.headers.get('x-forwarded-for')?.trim()
    if (forwarded && !forwarded.includes(',')) {
      const address = canonicalIp(forwarded)
      if (address) return hashNetwork(address, secret)
    }
  }
  return hashNetwork('local-development-network', secret)
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
