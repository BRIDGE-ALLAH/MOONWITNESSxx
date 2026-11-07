import { NextResponse } from 'next/server'
import { proxyArsyRequest } from '../../../../lib/arsy-proxy'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ id: string }> }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) return NextResponse.json(
    { error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } },
    { status: 400 },
  )
  return proxyArsyRequest(request, `/api/v1/assets/${id}`, 'GET')
}
