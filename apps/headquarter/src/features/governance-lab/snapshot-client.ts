import type {
  GovernanceSnapshotInput,
  GovernanceSnapshotRecord,
  GovernanceSnapshotSummary,
} from '@riotworks/contract'

export class GovernanceApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'GovernanceApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
      cache: 'no-store',
    })
  } catch {
    throw new GovernanceApiError('NETWORK_ERROR', 'The Headquarter server could not be reached.', 0)
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : 'UNKNOWN_ERROR'
    const message =
      typeof payload?.error?.message === 'string' ? payload.error.message : 'The request failed.'
    throw new GovernanceApiError(code, message, response.status)
  }
  return payload.data as T
}

export function listSnapshots(): Promise<{ snapshots: GovernanceSnapshotSummary[] }> {
  return request('/api/governance/snapshots')
}

export function getSnapshot(id: string): Promise<{ snapshot: GovernanceSnapshotRecord }> {
  return request(`/api/governance/snapshots/${encodeURIComponent(id)}`)
}

export function createSnapshot(
  input: GovernanceSnapshotInput
): Promise<{ snapshot: GovernanceSnapshotRecord }> {
  return request('/api/governance/snapshots', { method: 'POST', body: JSON.stringify(input) })
}

export function archiveSnapshot(id: string): Promise<{ snapshot: GovernanceSnapshotRecord }> {
  return request(`/api/governance/snapshots/${encodeURIComponent(id)}/archive`, { method: 'POST' })
}

export function describeGovernanceError(error: unknown): string {
  if (!(error instanceof GovernanceApiError))
    return 'Something went wrong while talking to the governance API.'
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'An authenticated operator session is required. Sign in on the login page, then reload.'
    case 'OPERATOR_AUTH_NOT_CONFIGURED':
    case 'ARSY_NOT_CONFIGURED':
      return 'The server-side ARSY connection is not configured. Set the operator session and ARSY connection environment variables.'
    case 'ARSY_UNREACHABLE':
      return 'ARSY could not be reached. Check that the ARSY service is running and reachable from Headquarter.'
    case 'GOVERNANCE_STORE_UNAVAILABLE':
      return 'The governance store is unavailable. Check the ARSY database connection and that migration 008 has been applied.'
    case 'VALIDATION_ERROR':
      return 'The snapshot input was rejected by ARSY validation.'
    default:
      return error.message
  }
}
