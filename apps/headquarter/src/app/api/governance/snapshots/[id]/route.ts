import { proxyArsyRequest } from '../../../../../lib/arsy-proxy.ts'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return proxyArsyRequest(request, `/api/v1/governance/snapshots/${encodeURIComponent(id)}`, 'GET')
}
