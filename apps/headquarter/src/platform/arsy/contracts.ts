/**
 * Public, frontend-safe contracts for the ARSY HTTP boundary.
 * Keep these types independent from ARSY's private runtime and persistence code.
 */
export type ArsyErrorPayload = {
  code?: string
  message?: string
  requestId?: string
  details?: unknown
}
export type ArsyErrorEnvelope = {
  error?: ArsyErrorPayload
  message?: string
  requestId?: string
}
export type ArsyRequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit
  /** Retry count applies only to GET requests and transient failures. */
  retries?: number
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}
