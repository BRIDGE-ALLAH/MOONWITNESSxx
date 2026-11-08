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
import {
  isSharedLoginLimitConfigured,
  requestSharedLoginLimit,
} from '../../../../lib/shared-login-limit.ts'

export const runtime = 'nodejs'

// Single-process fallback is for local development only. Production requires
// the shared ARSY/PostgreSQL limiter and fails closed when it is unavailable.
const LOGIN_FAILURE_LIMIT = 6
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

function rateLimited(retryAfterSeconds: number) {
  const retryAfter = Math.max(1, Math.min(900, Math.ceil(retryAfterSeconds)))
  return NextResponse.json(
    { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
    { status: 429, headers: { 'retry-after': String(retryAfter) } }
  )
}

function sharedLimitUnavailable() {
  return NextResponse.json(
    {
      error: {
        code: 'LOGIN_RATE_LIMIT_UNAVAILABLE',
        message: 'Shared login protection is unavailable. Try again later.',
      },
    },
    { status: 503 }
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
  return NextResponse.json({
    data: { authenticated: true, operatorId: session.operatorId, expiresAt: session.expiresAt },
  })
}

export async function POST(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return NextResponse.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  if (!requestHasTrustedOrigin(request, config.publicOrigin)) {
    return NextResponse.json({ error: { code: 'ORIGIN_REJECTED' } }, { status: 403 })
  }

  const useSharedLimit =
    process.env.NODE_ENV === 'production' || isSharedLoginLimitConfigured(request)

  if (!useSharedLimit) {
    const retryAfter = loginRetryAfter()
    if (retryAfter > 0) return rateLimited(retryAfter)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  const password =
    body && typeof body === 'object' && 'password' in body && typeof body.password === 'string'
      ? body.password
      : ''

  if (useSharedLimit) {
    let limit
    try {
      // Reserve before password KDF so parallel requests across replicas cannot
      // bypass the account/network attempt budget with simultaneous checks.
      limit = await requestSharedLoginLimit(request, 'attempt')
    } catch {
      return sharedLimitUnavailable()
    }
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)
  }

  if (!password || !(await operatorPasswordMatches(password, config.password, config.secret))) {
    if (!useSharedLimit) {
      const blockedFor = recordLoginFailure()
      if (blockedFor > 0) return rateLimited(blockedFor)
    }
    return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 })
  }

  if (useSharedLimit) {
    try {
      const reset = await requestSharedLoginLimit(request, 'success')
      if (!reset.allowed) return sharedLimitUnavailable()
    } catch {
      // Do not issue a session when the shared security state cannot be updated.
      return sharedLimitUnavailable()
    }
  } else {
    clearLoginFailures()
  }

  const response = NextResponse.json({
    data: { authenticated: true, operatorId: config.operatorId },
  })
  response.cookies.set(
    OPERATOR_SESSION_COOKIE,
    createOperatorSession(config.operatorId, config.secret),
    {
      httpOnly: true,
      secure: new URL(config.publicOrigin).protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60,
    }
  )
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
