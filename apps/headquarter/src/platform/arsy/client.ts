import type { ArsyErrorEnvelope, ArsyRequestOptions } from './contracts'

const API_PREFIX = '/api/v1'
const DEFAULT_TIMEOUT_MS = 12_000
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504])

export class ArsyApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string
  readonly details?: unknown

  constructor(message: string, options: { status: number; code?: string; requestId?: string; details?: unknown }) {
    super(message)
    this.name = 'ArsyApiError'
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
    this.details = options.details
  }
}

function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ARSY_API_BASE_URL?.trim()
  return (configured || API_PREFIX).replace(/\/+$/, '')
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `hq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function makeUrl(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '')
  const base = getBaseUrl()
  if (/^https?:\/\//i.test(base)) return new URL(normalizedPath, `${base}/`).toString()
  return `${base}/${normalizedPath}`
}

async function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const abort = () => {
      clearTimeout(timer)
      cleanup()
      reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError'))
    }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
  })
}

async function parseError(response: Response): Promise<ArsyApiError> {
  let payload: ArsyErrorEnvelope = {}
  try {
    payload = await response.json() as ArsyErrorEnvelope
  } catch {
    // A non-JSON gateway response is reduced to a safe status message.
  }
  const error = payload.error
  return new ArsyApiError(
    error?.message || payload.message || `ARSY request failed (${response.status})`,
    {
      status: response.status,
      code: error?.code,
      requestId: error?.requestId || payload.requestId || response.headers.get('x-request-id') || undefined,
      details: error?.details,
    },
  )
}

/**
 * Calls ARSY through its versioned public HTTP API.
 * Authentication is delegated to the configured same-site/session transport.
 */
export async function arsyRequest<T>(path: string, options: ArsyRequestOptions = {}): Promise<T> {
  const {
    headers: inputHeaders,
    retries = 1,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...init
  } = options
  const method = (init.method || 'GET').toUpperCase()
  const retryLimit = method === 'GET' ? Math.max(0, retries) : 0
  const requestId = createRequestId()
  const headers = new Headers(inputHeaders)
  headers.set('accept', 'application/json')
  headers.set('x-request-id', requestId)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

  let attempt = 0
  while (true) {
    if (externalSignal?.aborted) {
      throw externalSignal.reason ?? new DOMException('Request aborted', 'AbortError')
    }
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, timeoutMs)
    const abortFromCaller = () => controller.abort(externalSignal?.reason)
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true })

    try {
      const response = await fetch(makeUrl(path), {
        ...init,
        method,
        headers,
        credentials: 'include',
        cache: init.cache ?? 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await parseError(response)
        if (attempt < retryLimit && TRANSIENT_STATUS_CODES.has(response.status)) {
          attempt += 1
          await wait(250 * 2 ** (attempt - 1), externalSignal)
          continue
        }
        throw error
      }

      if (response.status === 204) return undefined as T
      return await response.json() as T
    } catch (error) {
      if (error instanceof ArsyApiError) throw error
      if (externalSignal?.aborted) throw externalSignal.reason ?? error
      if (timedOut) {
        if (attempt >= retryLimit) {
          throw new ArsyApiError('ARSY request timed out. Please try again.', {
            status: 0,
            code: 'TIMEOUT',
            requestId,
          })
        }
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      } else if (attempt >= retryLimit) {
        throw new ArsyApiError('ARSY is currently unreachable. Please try again.', {
          status: 0,
          code: 'NETWORK_ERROR',
          requestId,
        })
      }
      attempt += 1
      await wait(250 * 2 ** (attempt - 1), externalSignal)
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromCaller)
    }
  }
}
