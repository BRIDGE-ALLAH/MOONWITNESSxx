import { proxyArsyRequest } from '../../../lib/arsy-proxy'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString()
  return proxyArsyRequest(request, `/api/v1/payouts${query ? `?${query}` : ''}`, 'GET')
}
export async function POST(request: Request) {
  return proxyArsyRequest(request, '/api/v1/payouts', 'POST')
}
