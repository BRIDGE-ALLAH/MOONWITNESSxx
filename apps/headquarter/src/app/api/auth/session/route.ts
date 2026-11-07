import { NextResponse } from 'next/server'
import {
  createOperatorSession,
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  operatorPasswordMatches,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from '../../../../lib/operator-session'
import {
  callSharedLoginLimiter,
  createLoginAttemptBucketHashes,
  resolveTrustedClientNetworkIdentity,
} from '../../../../lib/login-attempt-limiter'

export const runtime = 'nodejs'

function unavailable(code: string) {
  return NextResponse.json({ error: { code, message: 'Login protection is temporarily unavailable. Try again later.' } }, { status: 503 })
}

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many failed login attempts. Try again later.' } },
    { status: 429, headers: { 'retry-after': String(Math.max(1, retryAfterSeconds)) } },
  )
}

export async function GET(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return NextResponse.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  const session = verifyOperatorSession(readOperatorSessionCookie(request), config.secret)
  if (!session || session.operatorId !== config.operatorId) {
    return NextResponse.json({ data: { authenticated: false } }, { status: 401 })
  }
  return NextResponse.json({ data: { authenticated: true, operatorId: session.operatorId, expiresAt: session.expiresAt } })
}

export async function POST(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return NextResponse.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  if (!requestHasTrustedOrigin(request, config.publicOrigin)) {
    return NextResponse.json({ error: { code: 'ORIGIN_REJECTED' } }, { status: 403 })
  }

  const clientIdentity = resolveTrustedClientNetworkIdentity(request, config.trustedProxyHops, config.proxyIdentitySecret ?? undefined)
  if (!clientIdentity) return unavailable('TRUSTED_CLIENT_IDENTITY_UNAVAILABLE')
  const buckets = createLoginAttemptBucketHashes(config.operatorId, clientIdentity, config.secret)
  const currentLimit = await callSharedLoginLimiter('check', buckets)
  if (!currentLimit.ok) return unavailable('LOGIN_PROTECTION_UNAVAILABLE')
  if (currentLimit.retryAfterSeconds > 0) return rateLimited(currentLimit.retryAfterSeconds)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  const password = body && typeof body === 'object' && 'password' in body && typeof body.password === 'string'
    ? body.password
    : ''
  if (!password || !operatorPasswordMatches(password, config.password, config.secret)) {
    const recorded = await callSharedLoginLimiter('failure', buckets)
    if (!recorded.ok) return unavailable('LOGIN_PROTECTION_UNAVAILABLE')
    if (recorded.retryAfterSeconds > 0) return rateLimited(recorded.retryAfterSeconds)
    return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 })
  }

  // A successful authentication clears both shared buckets before a session is issued.
  const cleared = await callSharedLoginLimiter('success', buckets)
  if (!cleared.ok) return unavailable('LOGIN_PROTECTION_UNAVAILABLE')

  const response = NextResponse.json({ data: { authenticated: true, operatorId: config.operatorId } })
  response.cookies.set(OPERATOR_SESSION_COOKIE, createOperatorSession(config.operatorId, config.secret), {
    httpOnly: true,
    secure: new URL(config.publicOrigin).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  })
  return response
}

export async function DELETE(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return NextResponse.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  if (!requestHasTrustedOrigin(request, config.publicOrigin)) {
    return NextResponse.json({ error: { code: 'ORIGIN_REJECTED' } }, { status: 403 })
  }
  const response = NextResponse.json({ data: { authenticated: false } })
  response.cookies.set(OPERATOR_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: new URL(config.publicOrigin).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
