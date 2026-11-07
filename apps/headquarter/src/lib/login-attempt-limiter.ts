import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

export interface LoginAttemptBucketHashes {
  operatorBucketHash: string
  networkBucketHash: string
}

export type LoginAttemptOperation = 'check' | 'failure' | 'success'

export function resolveTrustedClientNetworkIdentity(
  request: Request,
  trustedProxyHops: number,
  proxyIdentitySecret: string | undefined,
  nodeEnv = process.env.NODE_ENV,
  now = Date.now(),
): string | null {
  if (trustedProxyHops === 0) return nodeEnv === 'production' ? null : 'local-development'
  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 8 ||
      !proxyIdentitySecret || Buffer.byteLength(proxyIdentitySecret, 'utf8') < 32) return null

  // Only a private ingress that strips inbound x-mw-client-* headers may create
  // this short-lived HMAC assertion after resolving the configured trusted proxy chain.
  const address = request.headers.get('x-mw-client-ip')?.trim().toLowerCase()
  const timestamp = request.headers.get('x-mw-client-timestamp')?.trim()
  const suppliedSignature = request.headers.get('x-mw-client-signature')?.trim()
  if (!address || isIP(address) === 0 || !timestamp || !/^[0-9]{10}$/.test(timestamp) ||
      !suppliedSignature || !/^[a-f0-9]{64}$/i.test(suppliedSignature)) return null
  const issuedAt = Number(timestamp)
  if (!Number.isSafeInteger(issuedAt) || Math.abs(Math.floor(now / 1000) - issuedAt) > 60) return null

  const expected = createHmac('sha256', proxyIdentitySecret).update(`${address}.${timestamp}`).digest()
  const supplied = Buffer.from(suppliedSignature, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  return address
}

export function createLoginAttemptBucketHashes(
  operatorId: string,
  clientIdentity: string,
  secret: string,
): LoginAttemptBucketHashes {
  const digest = (scope: string, value: string) => createHmac('sha256', secret)
    .update(`moonwitness-login-attempt:v1:${scope}:${value}`)
    .digest('hex')
  return {
    operatorBucketHash: digest('operator', operatorId.trim().toLowerCase()),
    networkBucketHash: digest('network', clientIdentity),
  }
}

export async function callSharedLoginLimiter(
  operation: LoginAttemptOperation,
  buckets: LoginAttemptBucketHashes,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; retryAfterSeconds: number } | { ok: false }> {
  const baseUrl = env.ARSY_API_BASE_URL?.trim()
  const token = env.ARSY_OPERATOR_TOKEN?.trim()
  if (!baseUrl || !token) return { ok: false }

  try {
    const base = new URL(baseUrl)
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) return { ok: false }
    const response = await fetcher(new URL(`/api/v1/auth/login-attempts/${operation}`, base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-arsy-operator-token': token },
      body: JSON.stringify(buckets),
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false }
    const payload = await response.json() as { data?: { retryAfterSeconds?: unknown; cleared?: unknown } }
    if (operation === 'success') return payload.data?.cleared === true
      ? { ok: true, retryAfterSeconds: 0 }
      : { ok: false }
    const retryAfterSeconds = payload.data?.retryAfterSeconds
    if (typeof retryAfterSeconds !== 'number' || !Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 0) return { ok: false }
    return { ok: true, retryAfterSeconds }
  } catch {
    return { ok: false }
  }
}
