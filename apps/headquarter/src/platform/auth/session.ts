import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'mw_operator_session'
const SESSION_SECONDS = 8 * 60 * 60

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createOperatorSession(secret: string, now = Date.now()): string {
  if (secret.length < 32) throw new Error('HQ_SESSION_SECRET must contain at least 32 characters')
  const payload = Buffer.from(JSON.stringify({ sub: 'operator', exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

export function verifyOperatorSession(cookieHeader: string | null, secret: string | undefined, now = Date.now()): boolean {
  if (!cookieHeader || !secret || secret.length < 32) return false
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))
  if (!cookie) return false
  const token = cookie.slice(COOKIE_NAME.length + 1)
  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra) return false
  const expected = Buffer.from(signature(payload, secret))
  const actual = Buffer.from(suppliedSignature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }
    return decoded.sub === 'operator' && typeof decoded.exp === 'number' && decoded.exp > Math.floor(now / 1000)
  } catch {
    return false
  }
}

export function operatorCookieName(): string {
  return COOKIE_NAME
}
