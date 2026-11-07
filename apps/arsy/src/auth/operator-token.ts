import { timingSafeEqual } from 'node:crypto'

type OperatorRequest = {
  headers: Record<string, string | string[] | undefined>
}

/** Constant-time comparison for the private service-to-service operator credential. */
export function hasValidOperatorToken(request: OperatorRequest, token: string | undefined): boolean {
  if (!token) return false
  const supplied = request.headers['x-arsy-operator-token']
  if (typeof supplied !== 'string') return false
  const expected = Buffer.from(token)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
