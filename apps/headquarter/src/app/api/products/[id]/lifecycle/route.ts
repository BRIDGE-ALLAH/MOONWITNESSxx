import { proxyArsyRequest } from '../../../../../../lib/arsy-proxy'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: { code: 'INVALID_ID', message: 'Product ID must be a UUID.' } }, { status: 400 })
  }
  return proxyArsyRequest(request, `/api/v1/products/${id}/lifecycle`, 'PATCH')
}
