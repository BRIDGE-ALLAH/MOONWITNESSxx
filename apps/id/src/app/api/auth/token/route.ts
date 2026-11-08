import { NextRequest, NextResponse } from 'next/server'
import { issueSessionToken, SessionClaims } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const subject =
      typeof body.subject === 'string' && body.subject.trim()
        ? body.subject.trim()
        : 'operator-default'
    const role: SessionClaims['role'] = ['operator', 'admin', 'subscriber', 'guest'].includes(
      body.role
    )
      ? body.role
      : 'operator'

    const { token, claims } = issueSessionToken(subject, role)

    return NextResponse.json({
      ok: true,
      token,
      claims,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown issuance failure'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
