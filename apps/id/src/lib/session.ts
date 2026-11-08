import crypto from 'node:crypto'

export interface SessionClaims {
  sub: string
  role: 'operator' | 'admin' | 'subscriber' | 'guest'
  aud: string
  iss: string
  iat: number
  exp: number
  sessionId: string
}

const DEFAULT_SECRET = 'mw-id-ephemeral-key-do-not-use-in-production-1234567890'

export function getSigningSecret(): string {
  return process.env.ID_SIGNING_SECRET || DEFAULT_SECRET
}

export function issueSessionToken(
  subject: string,
  role: SessionClaims['role'] = 'operator',
  audience = 'moonwitness-universe',
  expiresInSeconds = 3600
): { token: string; claims: SessionClaims } {
  const now = Math.floor(Date.now() / 1000)
  const claims: SessionClaims = {
    sub: subject,
    role,
    aud: audience,
    iss: 'https://id.moonwitness.internal',
    iat: now,
    exp: now + expiresInSeconds,
    sessionId: crypto.randomUUID(),
  }

  const payloadStr = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const secret = getSigningSecret()
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url')

  return {
    token: `${payloadStr}.${signature}`,
    claims,
  }
}

export function verifySessionToken(token: string): {
  valid: boolean
  claims?: SessionClaims
  error?: string
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Empty or malformed token' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token structure' }
  }

  const [payloadStr, signature] = parts
  const secret = getSigningSecret()
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSig)

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Tampered signature or invalid secret' }
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf8')
    ) as SessionClaims
    const now = Math.floor(Date.now() / 1000)

    if (claims.exp < now) {
      return { valid: false, error: 'Session token expired' }
    }

    if (!claims.sub || !claims.role || !claims.sessionId) {
      return { valid: false, error: 'Incomplete claims payload' }
    }

    return { valid: true, claims }
  } catch {
    return { valid: false, error: 'Failed to decode claims payload' }
  }
}
