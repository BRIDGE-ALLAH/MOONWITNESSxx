import { NextResponse } from 'next/server'
import { proxyArsyRequest } from '../../../../../lib/arsy-proxy'

export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ id: string }> }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function productPath(context: RouteContext): Promise<string | NextResponse> {
  const { id } = await context.params
  if (!UUID_PATTERN.test(id)) return NextResponse.json(
    { error: { code: 'INVALID_ID', message: 'Product ID must be a UUID.' } },
    { status: 400 },
  )
  return `/api/v1/products/${id}/versions`
}

export async function GET(request: Request, context: RouteContext) {
  const path = await productPath(context)
  if (path instanceof NextResponse) return path
  return proxyArsyRequest(request, path, 'GET')
}
export async function POST(request: Request, context: RouteContext) {
  const path = await productPath(context)
  if (path instanceof NextResponse) return path
  return proxyArsyRequest(request, path, 'POST')
}
