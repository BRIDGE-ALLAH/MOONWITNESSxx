import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createOperatorSession, operatorCookieName } from '../../../platform/auth/session'

function passwordMatches(supplied: string, expected: string): boolean {
  const left = Buffer.from(supplied)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  const password = process.env.HQ_OPERATOR_PASSWORD
  const secret = process.env.HQ_SESSION_SECRET
  if (!password || !secret || secret.length < 32) {
    return NextResponse.json({ error: { message: 'Operator authentication is not configured.' } }, { status: 503 })
  }
  let supplied = ''
  try {
    const body = await request.json() as { password?: unknown }
    supplied = typeof body.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: { message: 'Invalid login request.' } }, { status: 400 })
  }
  if (!passwordMatches(supplied, password)) {
    return NextResponse.json({ error: { message: 'Invalid credentials.' } }, { status: 401 })
  }
  const response = NextResponse.json({ authenticated: true })
  response.cookies.set(operatorCookieName(), createOperatorSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  response.cookies.set(operatorCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
