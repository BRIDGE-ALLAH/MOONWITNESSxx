import { NextResponse } from 'next/server'
import {
  getOperatorSessionConfig,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from '@/lib/operator-session'

export const runtime = 'nodejs'

function arsyConfig() {
  const baseUrl = process.env.ARSY_API_BASE_URL?.trim()
  const operatorToken = process.env.ARSY_OPERATOR_TOKEN?.trim()
  if (!baseUrl || !operatorToken) return null
  return { baseUrl: baseUrl.replace(/\\/+$/, ''), operatorToken }
}

async function proxy(request: Request, method: 'GET' | 'POST') {
  const sessionConfig = getOperatorSessionConfig()
  if (!sessionConfig) {
    return NextResponse.json({
      error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED', message: 'Headquarter operator authentication is not configured.' },
    }, { status: 503 })
  }

  const session = verifyOperatorSession(readOperatorSessionCookie(request), sessionConfig.secret)
  if (!session || session.operatorId !== sessionConfig.operatorId) {
    return NextResponse.json({
      error: { code: 'UNAUTHENTICATED', message: 'An authenticated operator session is required.' },
    }, { status: 401 })
  }

  if (method === 'POST' && !requestHasTrustedOrigin(request, sessionConfig.publicOrigin)) {
    return NextResponse.json({
      error: { code: 'ORIGIN_REJECTED', message: 'Cross-origin state changes are not allowed.' },
    }, { status: 403 })
  }

  const config = arsyConfig()
  if (!config) {
    return NextResponse.json({
      error: { code: 'ARSY_NOT_CONFIGURED', message: 'The server-side ARSY connection is not configured.' },
    }, { status: 503 })
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/v1/opportunities`, {
      method,
      headers: {
        accept: 'application/json',
        'x-arsy-operator-token': config.operatorToken,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: await request.text() } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const payload = await response.json().catch(() => ({
      error: { code: 'INVALID_ARSY_RESPONSE', message: 'ARSY returned an unreadable response.' },
    }))
    return NextResponse.json(payload, { status: response.status })
  } catch {
    return NextResponse.json({
      error: { code: 'ARSY_UNREACHABLE', message: 'The ARSY service could not be reached.' },
    }, { status: 503 })
  }
}

export async function GET(request: Request) {
  return proxy(request, 'GET')
}

export async function POST(request: Request) {
  return proxy(request, 'POST')
}
