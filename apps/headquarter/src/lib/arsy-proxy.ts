import { NextResponse } from 'next/server.js'
import {
  getOperatorSessionConfig,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from './operator-session.ts'

export async function proxyArsyRequest(
  request: Request,
  apiPath: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
): Promise<NextResponse> {
  const sessionConfig = getOperatorSessionConfig()
  if (!sessionConfig) {
    return NextResponse.json({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED', message: 'Headquarter operator authentication is not configured.' } }, { status: 503 })
  }

  const session = verifyOperatorSession(readOperatorSessionCookie(request), sessionConfig.secret)
  if (!session || session.operatorId !== sessionConfig.operatorId) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'An authenticated operator session is required.' } }, { status: 401 })
  }

  if (method !== 'GET' && !requestHasTrustedOrigin(request, sessionConfig.publicOrigin)) {
    return NextResponse.json({ error: { code: 'ORIGIN_REJECTED', message: 'Cross-origin state changes are not allowed.' } }, { status: 403 })
  }

  const baseUrl = process.env.ARSY_API_BASE_URL?.trim()
  const operatorToken = process.env.ARSY_OPERATOR_TOKEN?.trim()
  if (!baseUrl || !operatorToken) {
    return NextResponse.json({ error: { code: 'ARSY_NOT_CONFIGURED', message: 'The server-side ARSY connection is not configured.' } }, { status: 503 })
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${apiPath}`, {
      method,
      headers: {
        accept: 'application/json',
        'x-arsy-operator-token': operatorToken,
        ...(method === 'POST' || method === 'PATCH' ? { 'content-type': 'application/json' } : {}),
        ...(request.headers.get('idempotency-key') ? { 'idempotency-key': request.headers.get('idempotency-key') as string } : {}),
      },
      ...(method === 'POST' || method === 'PATCH' ? { body: await request.text() } : {}),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => ({
      error: { code: 'INVALID_ARSY_RESPONSE', message: 'ARSY returned an unreadable response.' },
    }))
    return payload === null
      ? new NextResponse(null, { status: response.status })
      : NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json({ error: { code: 'ARSY_UNREACHABLE', message: 'The ARSY service could not be reached.' } }, { status: 503 })
  }
}
