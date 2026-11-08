import {
  OracleJobSubmissionResponseSchema,
  OracleJobViewSchema,
  type OracleJobSubmission,
  type OracleJobSubmissionResponse,
  type OracleJobView,
} from './contracts.ts'

export class OracleClientError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: string

  constructor(
    message: string,
    options: { status: number; code: string; retryAfter?: string },
  ) {
    super(message)
    this.name = 'OracleClientError'
    this.status = options.status
    this.code = options.code
    this.retryAfter = options.retryAfter
  }
}

export interface OracleClient {
  submitJob(
    payload: OracleJobSubmission,
    idempotencyKey?: string,
  ): Promise<OracleJobSubmissionResponse>
  getJob(jobId: string): Promise<OracleJobView>
}

type OracleEnvironment = {
  ORACLE_BASE_URL?: string
  ORACLE_SERVICE_TOKEN?: string
  ORACLE_REQUEST_TIMEOUT_MS?: string
}

type FetchLike = typeof fetch

function resolveConfig(env: OracleEnvironment): {
  baseUrl: string
  token: string
  timeoutMs: number
} {
  const rawUrl = env.ORACLE_BASE_URL?.trim()
  const token = env.ORACLE_SERVICE_TOKEN?.trim()
  if (!rawUrl || !token) {
    throw new OracleClientError(
      'ORACLE service connection is not configured in ARSY.',
      { status: 503, code: 'ORACLE_NOT_CONFIGURED' },
    )
  }
  if (token.length < 32) {
    throw new OracleClientError(
      'ORACLE service credential does not meet the minimum length.',
      { status: 503, code: 'ORACLE_CONFIG_INVALID' },
    )
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new OracleClientError(
      'ORACLE_BASE_URL must be a valid internal HTTP(S) origin.',
      { status: 503, code: 'ORACLE_CONFIG_INVALID' },
    )
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new OracleClientError(
      'ORACLE_BASE_URL must be an HTTP(S) origin without credentials, path, query, or fragment.',
      { status: 503, code: 'ORACLE_CONFIG_INVALID' },
    )
  }

  const rawTimeout = env.ORACLE_REQUEST_TIMEOUT_MS?.trim() || '5000'
  const timeoutMs = Number(rawTimeout)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new OracleClientError(
      'ORACLE_REQUEST_TIMEOUT_MS must be an integer between 100 and 30000.',
      { status: 503, code: 'ORACLE_CONFIG_INVALID' },
    )
  }

  return { baseUrl: url.origin, token, timeoutMs }
}

function mapUpstreamFailure(status: number, retryAfter: string | null): OracleClientError {
  const retry = retryAfter && /^\d{1,4}$/.test(retryAfter) ? retryAfter : undefined
  if (status === 404) {
    return new OracleClientError('ORACLE job was not found.', {
      status: 404,
      code: 'ORACLE_JOB_NOT_FOUND',
    })
  }
  if (status === 409) {
    return new OracleClientError('The idempotency key conflicts with an earlier ORACLE request.', {
      status: 409,
      code: 'ORACLE_IDEMPOTENCY_CONFLICT',
    })
  }
  if (status === 422 || status === 400) {
    return new OracleClientError('ORACLE rejected the validated job request.', {
      status: 422,
      code: 'ORACLE_REQUEST_REJECTED',
    })
  }
  if (status === 503 || status === 429) {
    return new OracleClientError('ORACLE is temporarily unable to accept the request.', {
      status: 503,
      code: 'ORACLE_UNAVAILABLE',
      retryAfter: retry,
    })
  }
  if (status === 504) {
    return new OracleClientError('ORACLE did not complete the request within its service deadline.', {
      status: 504,
      code: 'ORACLE_TIMEOUT',
    })
  }
  return new OracleClientError('ARSY could not complete the request with ORACLE.', {
    status: 502,
    code: 'ORACLE_UPSTREAM_ERROR',
  })
}

export function createOracleClient(
  env: OracleEnvironment = process.env,
  fetchImpl: FetchLike = fetch,
): OracleClient {
  async function request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST'
      body?: unknown
      idempotencyKey?: string
      validate: (payload: unknown) => { success: true; data: T } | { success: false }
    },
  ): Promise<T> {
    const config = resolveConfig(env)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      let response: Response
      try {
        response = await fetchImpl(config.baseUrl + path, {
          method: options.method,
          headers: {
            accept: 'application/json',
            authorization: 'Bearer ' + config.token,
            ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
            ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
          },
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
          redirect: 'error',
          signal: controller.signal,
        })
      } catch (error) {
        const timedOut = controller.signal.aborted ||
          (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
        throw new OracleClientError(
          timedOut
            ? 'ORACLE did not respond before the request deadline.'
            : 'ORACLE service is unreachable from ARSY.',
          {
            status: timedOut ? 504 : 503,
            code: timedOut ? 'ORACLE_TIMEOUT' : 'ORACLE_UNAVAILABLE',
          },
        )
      }

      if (!response.ok) {
        throw mapUpstreamFailure(response.status, response.headers.get('retry-after'))
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new OracleClientError('ORACLE returned a non-JSON response.', {
          status: 502,
          code: 'ORACLE_INVALID_RESPONSE',
        })
      }
      const parsed = options.validate(payload)
      if (!parsed.success) {
        throw new OracleClientError('ORACLE response did not match its published contract.', {
          status: 502,
          code: 'ORACLE_INVALID_RESPONSE',
        })
      }
      return parsed.data
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    submitJob(payload, idempotencyKey) {
      return request('/v1/jobs', {
        method: 'POST',
        body: payload,
        idempotencyKey,
        validate: (value) => OracleJobSubmissionResponseSchema.safeParse(value),
      })
    },
    getJob(jobId) {
      return request('/v1/jobs/' + encodeURIComponent(jobId), {
        method: 'GET',
        validate: (value) => OracleJobViewSchema.safeParse(value),
      })
    },
  }
}
