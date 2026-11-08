import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    let token = ''

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim()
    } else {
      const body = await req.json().catch(() => ({}))
      token = typeof body.token === 'string' ? body.token.trim() : ''
    }

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'No authorization token provided' },
        { status: 400 }
      )
    }

    const verification = verifySessionToken(token)

    if (!verification.valid) {
      return NextResponse.json({ ok: false, error: verification.error }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      claims: verification.claims,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal verification error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
