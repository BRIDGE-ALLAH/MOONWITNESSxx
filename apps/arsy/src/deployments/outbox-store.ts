import type { DatabasePool } from '../db.ts'
import type { JsonObject } from './contracts.ts'

type QueryResult<T> = { rows: T[] }

export interface DeploymentOutboxMessage {
  id: string
  operationId: string
  ownerId: string
  eventType: string
  payload: JsonObject
  attemptCount: number
  maxAttempts: number
  createdAt: string
}

export interface ClaimedDeploymentOutboxMessage extends DeploymentOutboxMessage {
  leaseOwner: string
  leaseToken: string
  leaseUntil: string
}

export interface ClaimOutboxInput {
  workerId: string
  ownerId?: string
  limit: number
  leaseSeconds: number
}

export type RetryDeploymentOutboxResult = 'retry_scheduled' | 'dead_lettered' | 'lease_lost'

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(`${field} must contain 1-${maxLength} printable characters`)
  }
  return normalized
}

function queryRows<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as QueryResult<T>).rows)) {
    throw new Error('Deployment outbox query returned an invalid result')
  }
  return (value as QueryResult<T>).rows
}

function jsonObject(value: unknown): JsonObject {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { throw new Error('Stored outbox payload is invalid JSON') }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored outbox payload must be a JSON object')
  }
  return parsed as JsonObject
}

function isoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Stored outbox timestamp is invalid')
  return date.toISOString()
}

function normalizeErrorCode(value: string): string {
  return /^[a-z][a-z0-9_]{0,79}$/.test(value) ? value : 'handler_failed'
}

interface ClaimedRow {
  id: string
  operation_id: string
  owner_id: string
  event_type: string
  payload: unknown
  attempt_count: number
  max_attempts: number
  created_at: Date | string
  locked_by: string
  lease_token: string
  locked_until: Date | string
}

export async function claimDeploymentOutbox(
  pool: DatabasePool,
  input: ClaimOutboxInput,
): Promise<ClaimedDeploymentOutboxMessage[]> {
  const workerId = requiredText(input.workerId, 'workerId', 128)
  const ownerId = input.ownerId === undefined ? null : requiredText(input.ownerId, 'ownerId', 128)
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new TypeError('Outbox claim limit must be an integer between 1 and 50')
  }
  if (!Number.isInteger(input.leaseSeconds) || input.leaseSeconds < 5 || input.leaseSeconds > 300) {
    throw new TypeError('Outbox lease must be between 5 and 300 seconds')
  }

  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM arsy_deployment_outbox
       WHERE delivered_at IS NULL
         AND dead_lettered_at IS NULL
         AND available_at <= now()
         AND attempt_count < max_attempts
         AND (locked_until IS NULL OR locked_until <= now())
         AND ($4::text IS NULL OR owner_id = $4)
       ORDER BY available_at, created_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     ),
     claimed AS (
       UPDATE arsy_deployment_outbox AS outbox
       SET locked_by = $2,
           locked_until = now() + ($3 * interval '1 second'),
           lease_token = gen_random_uuid(),
           attempt_count = outbox.attempt_count + 1
       FROM candidates
       WHERE outbox.id = candidates.id
       RETURNING outbox.id, outbox.operation_id, outbox.owner_id,
         outbox.event_type, outbox.payload, outbox.attempt_count,
         outbox.max_attempts, outbox.created_at, outbox.locked_by,
         outbox.lease_token, outbox.locked_until
     )
     SELECT id, operation_id, owner_id, event_type, payload,
       attempt_count, max_attempts, created_at, locked_by,
       lease_token, locked_until
     FROM claimed
     ORDER BY created_at, id`,
    [input.limit, workerId, input.leaseSeconds, ownerId],
  )

  return queryRows<ClaimedRow>(result).map((row) => {
    if (!row.id || !row.operation_id || !row.owner_id || !row.event_type ||
        !row.locked_by || !row.lease_token ||
        !Number.isInteger(row.attempt_count) || !Number.isInteger(row.max_attempts)) {
      throw new Error('Claimed outbox row is missing required fields')
    }
    return {
      id: row.id,
      operationId: row.operation_id,
      ownerId: row.owner_id,
      eventType: row.event_type,
      payload: jsonObject(row.payload),
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      createdAt: isoTimestamp(row.created_at),
      leaseOwner: row.locked_by,
      leaseToken: row.lease_token,
      leaseUntil: isoTimestamp(row.locked_until),
    }
  })
}

export interface ReapOutboxInput {
  limit: number
  ownerId?: string
}

export async function reapExpiredDeploymentOutbox(
  pool: DatabasePool,
  input: ReapOutboxInput,
): Promise<number> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
    throw new TypeError('Outbox reaper limit must be an integer between 1 and 50')
  }
  const ownerId = input.ownerId === undefined ? null : requiredText(input.ownerId, 'ownerId', 128)
  const result = await pool.query(
    `WITH expired AS (
       SELECT id
       FROM arsy_deployment_outbox
       WHERE delivered_at IS NULL
         AND dead_lettered_at IS NULL
         AND attempt_count >= max_attempts
         AND (locked_until IS NULL OR locked_until <= now())
         AND ($2::text IS NULL OR owner_id = $2)
       ORDER BY locked_until, created_at, id
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
    [input.limit, ownerId],
  )
  return queryRows<{ id: string }>(result).length
}

export async function acknowledgeDeploymentOutbox(
  pool: DatabasePool,
  message: ClaimedDeploymentOutboxMessage,
): Promise<boolean> {
  const id = requiredText(message.id, 'message.id', 64)
  const workerId = requiredText(message.leaseOwner, 'message.leaseOwner', 128)
  const leaseToken = requiredText(message.leaseToken, 'message.leaseToken', 64)
  const result = await pool.query(
    `UPDATE arsy_deployment_outbox
     SET delivered_at = now(),
         locked_by = NULL,
         locked_until = NULL,
         lease_token = NULL,
         last_error_code = NULL
     WHERE id = $1
       AND locked_by = $2
       AND lease_token = $3
       AND locked_until > now()
       AND delivered_at IS NULL
       AND dead_lettered_at IS NULL
     RETURNING id`,
    [id, workerId, leaseToken],
  )
  return queryRows<{ id: string }>(result).length === 1
}

export async function retryDeploymentOutbox(
  pool: DatabasePool,
  message: ClaimedDeploymentOutboxMessage,
  errorCode: string,
): Promise<RetryDeploymentOutboxResult> {
  const id = requiredText(message.id, 'message.id', 64)
  const workerId = requiredText(message.leaseOwner, 'message.leaseOwner', 128)
  const leaseToken = requiredText(message.leaseToken, 'message.leaseToken', 64)
  const safeCode = normalizeErrorCode(errorCode)
  const result = await pool.query(
    `UPDATE arsy_deployment_outbox
     SET last_error_code = $4,
         available_at = CASE
           WHEN attempt_count >= max_attempts THEN available_at
           ELSE now() + make_interval(secs => LEAST(3600, 5 * (1::bigint << LEAST(attempt_count - 1, 10)))::double precision)
         END,
         dead_lettered_at = CASE
           WHEN attempt_count >= max_attempts THEN now()
           ELSE NULL
         END,
         locked_by = NULL,
         locked_until = NULL,
         lease_token = NULL
     WHERE id = $1
       AND locked_by = $2
       AND lease_token = $3
       AND locked_until > now()
       AND delivered_at IS NULL
       AND dead_lettered_at IS NULL
     RETURNING dead_lettered_at`,
    [id, workerId, leaseToken, safeCode],
  )
  const row = queryRows<{ dead_lettered_at: Date | string | null }>(result)[0]
  if (!row) return 'lease_lost'
  return row.dead_lettered_at ? 'dead_lettered' : 'retry_scheduled'
}
