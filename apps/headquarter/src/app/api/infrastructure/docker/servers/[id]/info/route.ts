import { NextResponse } from 'next/server'
import { proxyArsyRequest } from '../../../../../../../lib/arsy-proxy'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  return proxyArsyRequest(request, `/api/v1/infrastructure/docker/servers/${id}/info`, 'GET')
}
