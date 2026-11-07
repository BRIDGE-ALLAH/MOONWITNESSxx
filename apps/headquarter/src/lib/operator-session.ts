import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const OPERATOR_SESSION_COOKIE = 'mw_operator_session'
const SESSION_TTL_SECONDS = 8 * 60 * 60

export interface OperatorSession {
  operatorId: string
  expiresAt: number
}

export interface OperatorSessionConfig {
  operatorId: string
  password: string
  secret: string
  publicOrigin: string
  trustedProxyHops: number
  proxyIdentitySecret: string | null
}

export function getOperatorSessionConfig(env: NodeJS.ProcessEnv = process.env): OperatorSessionConfig | null {
  const operatorId = env.ARSY_OPERATOR_ID?.trim()
  const password = env.HEADQUARTER_OPERATOR_PASSWORD?.trim()
  const secret = env.HEADQUARTER_SESSION_SECRET?.trim()
  const publicOrigin = env.HEADQUARTER_PUBLIC_ORIGIN?.trim()
  const trustedProxyHops = env.HEADQUARTER_TRUSTED_PROXY_HOPS?.trim()
    ? Number(env.HEADQUARTER_TRUSTED_PROXY_HOPS)
    : 0
  const proxyIdentitySecret = env.HEADQUARTER_PROXY_IDENTITY_SECRET?.trim() || null

  if (!operatorId || operatorId.length > 128 || !password || password.length < 16 ||
      !secret || Buffer.byteLength(secret, 'utf8') < 32 || !publicOrigin ||
      !Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 8 ||
      (env.NODE_ENV === 'production' && (trustedProxyHops < 1 || !proxyIdentitySecret || Buffer.byteLength(proxyIdentitySecret, 'utf8') < 32))) return null

  try {
    const parsedOrigin = new URL(publicOrigin)
    if (parsedOrigin.origin !== publicOrigin || !['http:', 'https:'].includes(parsedOrigin.protocol)) return null
    if (env.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:') return null
  } catch {
    return null
  }

  return { operatorId, password, secret, publicOrigin, trustedProxyHops, proxyIdentitySecret }
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

export function createOperatorSession(operatorId: string, secret: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ operatorId, expiresAt } satisfies OperatorSession)).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}

export function verifyOperatorSession(token: string | undefined, secret: string, now = Date.now()): OperatorSession | null {
  if (!token) return null
  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra !== undefined) return null

  let supplied: Buffer
  try {
    supplied = Buffer.from(suppliedSignature, 'base64url')
  } catch {
    return null
  }
  const expected = signature(payload, secret)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<OperatorSession>
    if (typeof decoded.operatorId !== 'string' || !decoded.operatorId.trim()) return null
    if (typeof decoded.expiresAt !== 'number' || !Number.isSafeInteger(decoded.expiresAt)) return null
    if (decoded.expiresAt <= Math.floor(now / 1000)) return null
    return { operatorId: decoded.operatorId, expiresAt: decoded.expiresAt }
  } catch {
    return null
  }
}

export function readOperatorSessionCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === OPERATOR_SESSION_COOKIE) {
      return part.slice(separator + 1).trim()
    }
  }
  return undefined
}

export function requestHasTrustedOrigin(request: Request, publicOrigin: string): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === publicOrigin
  } catch {
    return false
  }
}

export function operatorPasswordMatches(supplied: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(supplied).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}
