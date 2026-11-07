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

export const runtime = 'nodejs'

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }
  const password = body && typeof body === 'object' && 'password' in body && typeof body.password === 'string'
    ? body.password
    : ''
  if (!password || !operatorPasswordMatches(password, config.password)) {
    return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 })
  }

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
