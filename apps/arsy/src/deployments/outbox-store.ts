import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }

export interface DeploymentOutboxMessage {
  id: string
  operationId: string
  ownerId: string
  eventType: string
  payload: Record<string, unknown>
  attemptCount: number
  maxAttempts: number
  createdAt: string
}

export interface ClaimedDeploymentOutboxMessage extends DeploymentOutboxMessage {
  workerId: string
  leaseToken: string
  lockedUntil: string
}

export interface ClaimOutboxInput {
  workerId: string
  ownerId?: string
  limit?: number
  leaseSeconds?: number
}

export type OutboxRetryResult = 'retry_scheduled' | 'dead_lettered' | 'lease_lost'

interface OutboxRow {
  id: string
  operation_id: string
  owner_id: string
  event_type: string
  payload: Record<string, unknown> | string
  attempt_count: number
  max_attempts: number
  created_at: Date | string
  locked_until: Date | string
  lease_token: string
}

function queryRows<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as QueryResult<T>).rows)) {
    throw new Error('Deployment outbox query returned an invalid result')
  }
  return (value as QueryResult<T>).rows
}

function requiredWorkerId(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) {
    throw new TypeError('Outbox worker ID must use 1-128 safe identifier characters')
  }
  return value
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number, field: string): number {
  const candidate = value ?? fallback
  if (!Number.isInteger(candidate) || candidate < min || candidate > max) {
    throw new TypeError(`${field} must be an integer between ${min} and ${max}`)
  }
  return candidate
}

function requiredOwnerId(value: string): string {
  if (typeof value !== 'string') throw new TypeError('ownerId must be a string')
  const normalized = value.trim()
  if (!normalized || normalized.length > 128 ||
      [...normalized].some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      })) {
    throw new TypeError('ownerId must contain 1-128 printable characters')
  }
  return normalized
}

function jsonObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Deployment outbox payload must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Deployment outbox timestamp is invalid')
  return date.toISOString()
}

function mapClaim(row: OutboxRow, workerId: string): ClaimedDeploymentOutboxMessage {
  return {
    id: row.id,
    operationId: row.operation_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    payload: jsonObject(row.payload),
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    createdAt: iso(row.created_at),
    workerId,
    leaseToken: row.lease_token,
    lockedUntil: iso(row.locked_until),
  }
}

/**
 * Atomically claims due messages with SKIP LOCKED. One fresh fencing token is
 * generated per claim batch; every row additionally requires its ID and worker
 * identity when acknowledged or retried. Re-claiming an expired row replaces
 * the token and fences the old delivery attempt.
 */
export async function claimDeploymentOutbox(
  pool: DatabasePool,
  input: ClaimOutboxInput,
): Promise<ClaimedDeploymentOutboxMessage[]> {
  const workerId = requiredWorkerId(input.workerId)
  const ownerId = input.ownerId === undefined ? null : requiredOwnerId(input.ownerId)
  const limit = boundedInteger(input.limit, 10, 1, 50, 'limit')
  const leaseSeconds = boundedInteger(input.leaseSeconds, 30, 5, 300, 'leaseSeconds')

  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM arsy_deployment_outbox
       WHERE delivered_at IS NULL
         AND dead_lettered_at IS NULL
         AND available_at <= now()
         AND (locked_until IS NULL OR locked_until <= now())
         AND attempt_count < max_attempts
         AND ($4::text IS NULL OR owner_id = $4)
       ORDER BY available_at ASC, created_at ASC, id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $2
     ),
     claimed AS (
       UPDATE arsy_deployment_outbox AS outbox
       SET locked_by = $1,
           locked_until = now() + make_interval(secs => $3),
           lease_token = gen_random_uuid(),
           attempt_count = outbox.attempt_count + 1
       FROM candidates
       WHERE outbox.id = candidates.id
       RETURNING outbox.id, outbox.operation_id, outbox.owner_id,
         outbox.event_type, outbox.payload, outbox.attempt_count,
         outbox.max_attempts, outbox.created_at, outbox.locked_until,
         outbox.lease_token
     )
     SELECT id, operation_id, owner_id, event_type, payload,
       attempt_count, max_attempts, created_at, locked_until, lease_token
     FROM claimed
     ORDER BY created_at ASC, id ASC`,
    [workerId, limit, leaseSeconds, ownerId],
  )
  return queryRows<OutboxRow>(result).map((row) => mapClaim(row, workerId))
}

export interface ReapOutboxInput {
  limit?: number
  ownerId?: string
}

/** Reap at most one bounded batch of expired final-attempt leases. */
export async function reapExpiredDeploymentOutbox(
  pool: DatabasePool,
  input: ReapOutboxInput,
): Promise<number> {
  const limit = boundedInteger(input.limit, 10, 1, 50, 'reaper limit')
  const ownerId = input.ownerId === undefined ? null : requiredOwnerId(input.ownerId)
  const result = await pool.query(
    `WITH expired AS (
       SELECT id
       FROM arsy_deployment_outbox
       WHERE delivered_at IS NULL
         AND dead_lettered_at IS NULL
         AND attempt_count >= max_attempts
         AND (locked_until IS NULL OR locked_until <= now())
         AND ($2::text IS NULL OR owner_id = $2)
       ORDER BY locked_until ASC, created_at ASC, id ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE arsy_deployment_outbox AS outbox
     SET dead_lettered_at = now(),
         locked_by = NULL,
         locked_until = NULL,
         lease_token = NULL,
         last_error_code = COALESCE(outbox.last_error_code, 'attempts_exhausted')
     FROM expired
     WHERE outbox.id = expired.id
     RETURNING outbox.id`,
    [limit, ownerId],
  )
  return queryRows<{ id: string }>(result).length
}

function assertLease(message: ClaimedDeploymentOutboxMessage): void {
  if (!message || !/^[0-9a-f-]{36}$/i.test(message.leaseToken) ||
      !message.id || !message.workerId) {
    throw new TypeError('Outbox lease identity is invalid')
  }
}

export async function acknowledgeDeploymentOutbox(
  pool: DatabasePool,
  message: ClaimedDeploymentOutboxMessage,
): Promise<boolean> {
  assertLease(message)
  const result = await pool.query(
    `UPDATE arsy_deployment_outbox
     SET delivered_at = now(),
         locked_by = NULL,
         locked_until = NULL,
         lease_token = NULL,
         last_error_code = NULL
     WHERE id = $1 AND locked_by = $2 AND lease_token = $3
       AND locked_until > now()
       AND delivered_at IS NULL AND dead_lettered_at IS NULL
     RETURNING id`,
    [message.id, message.workerId, message.leaseToken],
  )
  return queryRows<{ id: string }>(result).length === 1
}

export async function retryDeploymentOutbox(
  pool: DatabasePool,
  message: ClaimedDeploymentOutboxMessage,
  errorCode: string,
): Promise<OutboxRetryResult> {
  assertLease(message)
  const safeCode = typeof errorCode === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(errorCode)
    ? errorCode
    : 'handler_failed'
  const result = await pool.query(
    `UPDATE arsy_deployment_outbox
     SET locked_by = NULL,
         locked_until = NULL,
         lease_token = NULL,
         last_error_code = $4,
         available_at = CASE
           WHEN attempt_count >= max_attempts THEN available_at
           ELSE now() + make_interval(secs => LEAST(3600, 5 * (1::bigint << LEAST(attempt_count - 1, 10)))::double precision)
         END,
         dead_lettered_at = CASE WHEN attempt_count >= max_attempts THEN now() ELSE NULL END
     WHERE id = $1 AND locked_by = $2 AND lease_token = $3
       AND locked_until > now()
       AND delivered_at IS NULL AND dead_lettered_at IS NULL
     RETURNING dead_lettered_at`,
    [message.id, message.workerId, message.leaseToken, safeCode],
  )
  const row = queryRows<{ dead_lettered_at: Date | string | null }>(result)[0]
  if (!row) return 'lease_lost'
  return row.dead_lettered_at ? 'dead_lettered' : 'retry_scheduled'
}
