import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

export type LoginLimitAction = 'attempt' | 'success'

export interface LoginLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

const NETWORK_HASH_DOMAIN = 'moonwitness-login-network-v1:'
const TRUSTED_IP_SIGNATURE_DOMAIN = 'moonwitness-client-ip-v1:'

function canonicalIp(address: string): string | null {
  const candidate = address.trim()
  const version = isIP(candidate)
  if (version === 4) return candidate
  if (version !== 6) return null

  try {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1).toLowerCase()
  } catch {
    return null
  }
}

/**
 * Signature expected from the single trusted ingress. The ingress must remove
 * any client-supplied copies of both headers and write these from its socket
 * peer address; the application never trusts X-Forwarded-For directly.
 */
export function createTrustedClientIpSignature(address: string, secret: string): string {
  const ip = canonicalIp(address)
  if (!ip || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new TypeError('A valid IP address and 32-byte trusted-proxy secret are required')
  }
  return createHmac('sha256', secret).update(TRUSTED_IP_SIGNATURE_DOMAIN).update(ip).digest('hex')
}

function networkHash(address: string, secret: string): string {
  return createHmac('sha256', secret).update(NETWORK_HASH_DOMAIN).update(address).digest('hex')
}

/**
 * Development intentionally uses one synthetic network bucket and ignores
 * all forwarding headers. Production requires exactly one trusted ingress and
 * a valid HMAC-signed canonical client IP; unsigned client headers fail closed.
 */
export function resolveLoginNetworkHash(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const sessionSecret = env.HEADQUARTER_SESSION_SECRET?.trim()
  if (!sessionSecret || Buffer.byteLength(sessionSecret, 'utf8') < 32) return null

  if (env.NODE_ENV !== 'production') {
    return networkHash('local-development-network', sessionSecret)
  }

  if (env.HEADQUARTER_TRUSTED_PROXY_HOPS !== '1') return null
  const proxySecret = env.HEADQUARTER_TRUSTED_PROXY_SECRET?.trim()
  if (!proxySecret || Buffer.byteLength(proxySecret, 'utf8') < 32) return null

  const ip = canonicalIp(request.headers.get('x-moonwitness-client-ip') ?? '')
  const suppliedSignature = request.headers.get('x-moonwitness-client-ip-signature') ?? ''
  if (!ip || !/^[a-f0-9]{64}$/.test(suppliedSignature)) return null

  const expectedSignature = Buffer.from(createTrustedClientIpSignature(ip, proxySecret), 'hex')
  const actualSignature = Buffer.from(suppliedSignature, 'hex')
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null
  }

  return networkHash(ip, sessionSecret)
}

function resolveArsyBaseUrl(env: NodeJS.ProcessEnv): string | null {
  const raw = env.ARSY_API_BASE_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    )
      return null
    return url.origin
  } catch {
    return null
  }
}

export function isSharedLoginLimitConfigured(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(
    resolveLoginNetworkHash(request, env) &&
    resolveArsyBaseUrl(env) &&
    (env.ARSY_OPERATOR_TOKEN?.trim().length ?? 0) >= 32
  )
}

export async function requestSharedLoginLimit(
  request: Request,
  action: LoginLimitAction,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<LoginLimitResult> {
  const networkHash = resolveLoginNetworkHash(request, env)
  const baseUrl = resolveArsyBaseUrl(env)
  const operatorToken = env.ARSY_OPERATOR_TOKEN?.trim()
  if (!networkHash || !baseUrl || !operatorToken || operatorToken.length < 32) {
    throw new Error('SHARED_LOGIN_LIMIT_NOT_CONFIGURED')
  }

  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}/api/v1/auth/login-attempts`, {
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
  } catch {
    throw new Error('SHARED_LOGIN_LIMIT_UNAVAILABLE')
  }

  if (!response.ok) throw new Error('SHARED_LOGIN_LIMIT_UNAVAILABLE')

  let payload: unknown
  try {
    const body = await response.text()
    if (Buffer.byteLength(body, 'utf8') > 4_096) throw new Error('response_too_large')
    payload = JSON.parse(body)
  } catch {
    throw new Error('SHARED_LOGIN_LIMIT_INVALID_RESPONSE')
  }

  const data =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: Partial<LoginLimitResult> }).data
      : undefined
  if (
    !data ||
    typeof data.allowed !== 'boolean' ||
    typeof data.retryAfterSeconds !== 'number' ||
    !Number.isSafeInteger(data.retryAfterSeconds) ||
    data.retryAfterSeconds < 0 ||
    data.retryAfterSeconds > 900
  ) {
    throw new Error('SHARED_LOGIN_LIMIT_INVALID_RESPONSE')
  }

  return { allowed: data.allowed, retryAfterSeconds: data.retryAfterSeconds }
}
