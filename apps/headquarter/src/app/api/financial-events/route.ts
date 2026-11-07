import { proxyArsyRequest } from '../../../lib/arsy-proxy'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.toString()
  return proxyArsyRequest(request, `/api/v1/financial-events${query ? `?${query}` : ''}`, 'GET')
}
export async function POST(request: Request) {
  return proxyArsyRequest(request, '/api/v1/financial-events', 'POST')
}
