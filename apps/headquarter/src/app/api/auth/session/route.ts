import { NextResponse } from 'next/server.js'
import {
  createOperatorSession,
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  operatorPasswordMatches,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from '../../../../lib/operator-session.ts'

export const runtime = 'nodejs'

// Single-operator, process-local fallback throttle. Production ingress must also
// enforce a shared rate limit if the service is ever scaled beyond one process.
const LOGIN_FAILURE_LIMIT = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000
let loginWindowStartedAt = 0
let loginFailureCount = 0
let loginBlockedUntil = 0

function loginRetryAfter(now = Date.now()): number {
  if (loginBlockedUntil > now) return Math.ceil((loginBlockedUntil - now) / 1000)
  if (loginWindowStartedAt && now - loginWindowStartedAt >= LOGIN_WINDOW_MS) {
    loginWindowStartedAt = 0
    loginFailureCount = 0
    loginBlockedUntil = 0
  }
  return 0
}

function recordLoginFailure(now = Date.now()): number {
  if (!loginWindowStartedAt || now - loginWindowStartedAt >= LOGIN_WINDOW_MS) {
    loginWindowStartedAt = now
    loginFailureCount = 0
  }
  loginFailureCount += 1
  if (loginFailureCount >= LOGIN_FAILURE_LIMIT) {
    loginBlockedUntil = now + LOGIN_WINDOW_MS
    loginFailureCount = 0
    return LOGIN_WINDOW_MS / 1000
  }
  return 0
}

function clearLoginFailures(): void {
  loginWindowStartedAt = 0
  loginFailureCount = 0
  loginBlockedUntil = 0
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

  const retryAfter = loginRetryAfter()
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many failed login attempts. Try again later.' } },
      { status: 429, headers: { 'retry-after': String(retryAfter) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  const password = body && typeof body === 'object' && 'password' in body && typeof body.password === 'string'
    ? body.password
    : ''
  if (!password || !(await operatorPasswordMatches(password, config.password, config.secret))) {
    const blockedFor = recordLoginFailure()
    if (blockedFor > 0) {
      return NextResponse.json(
        { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many failed login attempts. Try again later.' } },
        { status: 429, headers: { 'retry-after': String(blockedFor) } },
      )
    }
    return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 })
  }
  clearLoginFailures()

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
