import {
  createOperatorSession,
  getOperatorSessionConfig,
  OPERATOR_SESSION_COOKIE,
  operatorPasswordMatches,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from '../../../../lib/operator-session.ts'
import { requestSharedLoginLimit } from '../../../../lib/shared-login-limit.ts'

export const runtime = 'nodejs'

function rateLimited(retryAfterSeconds: number) {
  const retryAfter = Math.max(1, retryAfterSeconds)
  return Response.json(
    { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many failed login attempts. Try again later.' } },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  )
}

export async function GET(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return Response.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  const session = verifyOperatorSession(readOperatorSessionCookie(request), config.secret)
  if (!session || session.operatorId !== config.operatorId) {
    return Response.json({ data: { authenticated: false } }, { status: 401 })
  }
  return Response.json({ data: { authenticated: true, operatorId: session.operatorId, expiresAt: session.expiresAt } })
}

export async function POST(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return Response.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  if (!requestHasTrustedOrigin(request, config.publicOrigin)) {
    return Response.json({ error: { code: 'ORIGIN_REJECTED' } }, { status: 403 })
  }

  let limit
  try {
    limit = await requestSharedLoginLimit(request, 'check')
  } catch {
    return Response.json(
      { error: { code: 'LOGIN_RATE_LIMIT_UNAVAILABLE', message: 'Shared login protection is unavailable. Try again later.' } },
      { status: 503 },
    )
  }
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  const password = body && typeof body === 'object' && 'password' in body && typeof body.password === 'string'
    ? body.password
    : ''
  if (!password || !await operatorPasswordMatches(password, config.password, config.secret)) {
    try {
      const failure = await requestSharedLoginLimit(request, 'failure')
      if (!failure.allowed) return rateLimited(failure.retryAfterSeconds)
    } catch {
      return Response.json(
        { error: { code: 'LOGIN_RATE_LIMIT_UNAVAILABLE', message: 'Shared login protection is unavailable. Try again later.' } },
        { status: 503 },
      )
    }
    return Response.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 })
  }

  try {
    await requestSharedLoginLimit(request, 'success')
  } catch {
    return Response.json(
      { error: { code: 'LOGIN_RATE_LIMIT_UNAVAILABLE', message: 'Shared login protection is unavailable. Try again later.' } },
      { status: 503 },
    )
  }

  const response = Response.json({ data: { authenticated: true, operatorId: config.operatorId } })
  const secure = new URL(config.publicOrigin).protocol === 'https:' ? '; Secure' : ''
  response.headers.append(
    'set-cookie',
    `${OPERATOR_SESSION_COOKIE}=${createOperatorSession(config.operatorId, config.secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${8 * 60 * 60}${secure}`,
  )
  return response
}

export async function DELETE(request: Request) {
  const config = getOperatorSessionConfig()
  if (!config) {
    return Response.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } }, { status: 503 })
  }
  if (!requestHasTrustedOrigin(request, config.publicOrigin)) {
    return Response.json({ error: { code: 'ORIGIN_REJECTED' } }, { status: 403 })
  }
  const response = Response.json({ data: { authenticated: false } })
  const secure = new URL(config.publicOrigin).protocol === 'https:' ? '; Secure' : ''
  response.headers.append(
    'set-cookie',
    `${OPERATOR_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`,
  )
  return response
}
