import { NextResponse } from 'next/server.js'
import { proxyArsyRequest } from '../../../../lib/arsy-proxy.ts'

export const runtime = 'nodejs'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type RouteContext = { params: Promise<{ path: string[] }> }

const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'
const routes: Array<{ pattern: RegExp; methods: Method[] }> = [
  { pattern: /^opportunities$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^opportunities/${uuid}$`), methods: ['GET', 'PATCH', 'DELETE'] },
  { pattern: new RegExp(`^opportunities/${uuid}/decision$`), methods: ['PATCH'] },
  { pattern: /^products$/, methods: ['GET'] },
  { pattern: /^products/from-opportunity$/, methods: ['POST'] },
  { pattern: new RegExp(`^products/${uuid}$`), methods: ['GET'] },
  { pattern: new RegExp(`^products/${uuid}/versions$`), methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^products/${uuid}/lifecycle$`), methods: ['PATCH'] },
  { pattern: /^assets$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^assets/${uuid}$`), methods: ['GET'] },
  { pattern: new RegExp(`^assets/${uuid}/inspections$`), methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^assets/${uuid}/readiness$`), methods: ['GET'] },
  { pattern: /^channels$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^channels/${uuid}$`), methods: ['GET', 'PATCH'] },
  { pattern: new RegExp(`^channels/${uuid}/evidence$`), methods: ['GET', 'POST'] },
  { pattern: /^listings$/, methods: ['GET'] },
  { pattern: /^listings/packages$/, methods: ['POST'] },
  { pattern: new RegExp(`^listings/${uuid}$`), methods: ['GET'] },
  { pattern: new RegExp(`^listings/${uuid}/receipts$`), methods: ['GET', 'POST'] },
  { pattern: /^financial-events$/, methods: ['GET', 'POST'] },
  { pattern: /^financial-summary$/, methods: ['GET'] },
  { pattern: new RegExp(`^financial-events/${uuid}/reconciliation$`), methods: ['PATCH'] },
  { pattern: /^payouts$/, methods: ['GET', 'POST'] },
  { pattern: new RegExp(`^payouts/${uuid}/status$`), methods: ['PATCH'] },
  { pattern: /^fx-conversions$/, methods: ['GET', 'POST'] },
  { pattern: /^portfolio-metrics$/, methods: ['GET'] },
]

async function handle(request: Request, context: RouteContext, method: Method) {
  const { path: segments } = await context.params
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((segment) => !/^[a-zA-Z0-9-]+$/.test(segment))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Money Maker API route was not found.' } }, { status: 404 })
  }
  const path = segments.join('/')
  if (!routes.some((route) => route.methods.includes(method) && route.pattern.test(path))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Money Maker API route was not found.' } }, { status: 404 })
  }
  const query = method === 'GET' ? new URL(request.url).search : ''
  const apiPath = `/api/v1/${segments.map((segment) => encodeURIComponent(segment)).join('/')}${query}`
  return proxyArsyRequest(request, apiPath, method)
}

export async function GET(request: Request, context: RouteContext) { return handle(request, context, 'GET') }
export async function POST(request: Request, context: RouteContext) { return handle(request, context, 'POST') }
export async function PATCH(request: Request, context: RouteContext) { return handle(request, context, 'PATCH') }
export async function DELETE(request: Request, context: RouteContext) { return handle(request, context, 'DELETE') }
