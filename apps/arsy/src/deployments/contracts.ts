import { createHash } from 'node:crypto'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type DeploymentOperationKind = 'deploy' | 'stop' | 'restart' | 'rollback'
export type DeploymentOperationStatus =
  | 'queued'
  | 'running'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'blocked'

const MAX_METADATA_BYTES = 64 * 1024
const SENSITIVE_METADATA_KEY =
  /(password|token|api.?key|private.?key|credential|certificate|secret.?value|environment|authorization|^env$)/i

function normalizeJson(value: unknown, path: string, depth: number): JsonValue {
  if (depth > 12) throw new TypeError(`${path} exceeds the maximum JSON nesting depth`)
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`)
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeJson(item, `${path}[${index}]`, depth + 1))
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${path} contains a value that cannot be represented as JSON`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must contain only plain JSON objects`)
  }

  const result: Record<string, JsonValue> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (SENSITIVE_METADATA_KEY.test(key)) {
      throw new TypeError(`${path} contains a forbidden secret-bearing field: ${key}`)
    }
    result[key] = normalizeJson(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
      depth + 1,
    )
  }
  return result
}

/** Canonical JSON for hashes and persisted non-secret deployment metadata. */
function serializeNormalized(value: JsonValue): string {
  const serialized = JSON.stringify(value)
  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw new TypeError('Deployment metadata exceeds the 64 KiB limit')
  }
  return serialized
}

export function canonicalJson(value: unknown): string {
  return serializeNormalized(normalizeJson(value, 'metadata', 0))
}

export function canonicalJsonObject(value: unknown): string {
  const normalized = normalizeJson(value, 'metadata', 0)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new TypeError('Deployment metadata must be a JSON object')
  }
  return serializeNormalized(normalized)
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function assertImageDigest(value: string): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new TypeError('Deployment image must be an immutable sha256 OCI digest')
  }
}

const TRANSITIONS: Record<DeploymentOperationStatus, readonly DeploymentOperationStatus[]> = {
  queued: ['running', 'cancelled', 'blocked'],
  running: ['verifying', 'failed', 'cancelled', 'blocked'],
  verifying: ['succeeded', 'failed', 'cancelled', 'blocked'],
  succeeded: [],
  failed: [],
  cancelled: [],
  blocked: [],
}

export function assertOperationTransition(
  from: DeploymentOperationStatus,
  to: DeploymentOperationStatus,
): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid deployment operation transition: ${from} -> ${to}`)
  }
}
