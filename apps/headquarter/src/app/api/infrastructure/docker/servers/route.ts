import { proxyArsyRequest } from ''../../../../../lib/arsy-proxy.ts'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return proxyArsyRequest(request, '/api/v1/infrastructure/docker/servers', 'GET')
}

export async function POST(request: Request) {
  return proxyArsyRequest(request, '/api/v1/infrastructure/docker/servers', 'POST')
}
