import { proxyArsyRequest } from '../../../../lib/arsy-proxy'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  return proxyArsyRequest(request, '/api/v1/listings/packages', 'POST')
}
