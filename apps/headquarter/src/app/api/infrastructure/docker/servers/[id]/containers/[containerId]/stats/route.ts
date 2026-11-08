import { NextResponse } from 'next/server.js'
import { proxyArsyRequest } from '../../../../../../../../../lib/arsy-proxy.ts'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ id: string; containerId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTAINER_ID = /^[a-f0-9]{12,64}$/i

export async function GET(request: Request, context: RouteContext) {
  const { id, containerId } = await context.params
  if (!UUID.test(id)) return NextResponse.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  if (!CONTAINER_ID.test(containerId)) {
    return NextResponse.json({ error: { code: 'INVALID_CONTAINER_ID' } }, { status: 400 })
  }
  return proxyArsyRequest(
    request,
    `/api/v1/infrastructure/docker/servers/${id}/containers/${containerId}/stats`,
    'GET',
  )
}
