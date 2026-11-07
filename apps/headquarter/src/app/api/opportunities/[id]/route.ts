import { proxyArsyRequest } from '../../../../lib/arsy-proxy.ts'

export const runtime = 'nodejs'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type RouteContext = { params: Promise<{ id: string }> }

async function getOpportunityId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params
  return UUID_PATTERN.test(id) ? id : null
}

export async function GET(request: Request, context: RouteContext) {
  const id = await getOpportunityId(context)
  if (!id) return Response.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  return proxyArsyRequest(request, `/api/v1/opportunities/${encodeURIComponent(id)}`, 'GET')
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await getOpportunityId(context)
  if (!id) return Response.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  return proxyArsyRequest(request, `/api/v1/opportunities/${encodeURIComponent(id)}`, 'PATCH')
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await getOpportunityId(context)
  if (!id) return Response.json({ error: { code: 'INVALID_ID' } }, { status: 400 })
  return proxyArsyRequest(request, `/api/v1/opportunities/${encodeURIComponent(id)}`, 'DELETE')
}
