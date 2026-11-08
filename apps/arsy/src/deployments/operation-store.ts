import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import {
  assertImageDigest,
  assertOperationTransition,
  canonicalJson,
  hashCanonicalJson,
  type DeploymentOperationKind,
  type DeploymentOperationStatus,
  type JsonObject,
} from './contracts.ts'

type QueryResult<T> = { rows: T[] }

export interface DeploymentRow {
  id: string
  owner_id: string
  docker_server_id: string
  name: string
  desired_image_digest: string | null
  desired_config: JsonObject
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DeploymentOperationRow {
  id: string
  deployment_id: string
  owner_id: string
  actor_id: string
  kind: DeploymentOperationKind
  status: DeploymentOperationStatus
  idempotency_key: string
  request_hash: string
  request_payload: JsonObject
  attempt_count: number
  created_at: string
  updated_at: string
}

export interface CreateDeploymentInput {
  ownerId: string
  actorId: string
  dockerServerId: string
  name: string
  desiredImageDigest?: string | null
  desiredConfig?: JsonObject
}

export interface CreateOperationInput {
  ownerId: string
  actorId: string
  deploymentId: string
  kind: DeploymentOperationKind
  idempotencyKey: string
  requestPayload?: JsonObject
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used for a different deployment request')
    this.name = 'IdempotencyConflictError'
  }
}

export class OperationStateConflictError extends Error {
  constructor() {
    super('Deployment operation state changed before the requested transition')
    this.name = 'OperationStateConflictError'
  }
}

function requiredText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw new TypeError(`${field} must contain 1-${maxLength} characters`)
  }
  return normalized
}

function queryRows<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as QueryResult<T>).rows)) {
    throw new Error('Database query returned an invalid result')
  }
  return (value as QueryResult<T>).rows
}

export async function createDeployment(
  pool: DatabasePool,
  input: CreateDeploymentInput,
): Promise<DeploymentRow> {
  const ownerId = requiredText(input.ownerId, 'ownerId', 128)
  const actorId = requiredText(input.actorId, 'actorId', 128)
  const dockerServerId = requiredText(input.dockerServerId, 'dockerServerId', 64)
  const name = requiredText(input.name, 'name', 80)
  const desiredConfig = canonicalJson(input.desiredConfig ?? {})
  const imageDigest = input.desiredImageDigest ?? null
  if (imageDigest !== null) assertImageDigest(imageDigest)

  const result = await pool.query(
    `INSERT INTO arsy_deployments
      (id, owner_id, docker_server_id, name, desired_image_digest, desired_config, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, owner_id, docker_server_id, name, desired_image_digest,
       desired_config, status, created_by, created_at, updated_at`,
    [randomUUID(), ownerId, dockerServerId, name, imageDigest, desiredConfig, actorId],
  )
  const row = queryRows<DeploymentRow>(result)[0]
  if (!row) throw new Error('Deployment insert did not return a record')
  return row
}

export async function createDeploymentOperation(
  pool: DatabasePool,
  input: CreateOperationInput,
): Promise<{ disposition: 'created' | 'replayed'; operation: DeploymentOperationRow }> {
  const ownerId = requiredText(input.ownerId, 'ownerId', 128)
  const actorId = requiredText(input.actorId, 'actorId', 128)
  const deploymentId = requiredText(input.deploymentId, 'deploymentId', 64)
  const idempotencyKey = requiredText(input.idempotencyKey, 'idempotencyKey', 200)
  if (idempotencyKey.length < 8) throw new TypeError('idempotencyKey must contain at least 8 characters')

  const requestPayloadJson = canonicalJson(input.requestPayload ?? {})
  const requestPayload = JSON.parse(requestPayloadJson) as JsonObject
  const requestHash = hashCanonicalJson({
    actorId,
    deploymentId,
    kind: input.kind,
    requestPayload,
  })
  const operationId = randomUUID()
  const outboxId = randomUUID()

  const inserted = await pool.query(
    `WITH inserted AS (
       INSERT INTO arsy_deployment_operations
         (id, deployment_id, owner_id, actor_id, kind, status,
          idempotency_key, request_hash, request_payload)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8::jsonb)
       ON CONFLICT (owner_id, idempotency_key) DO NOTHING
       RETURNING id, deployment_id, owner_id, actor_id, kind, status,
         idempotency_key, request_hash, request_payload, attempt_count,
         created_at, updated_at
     ),
     event_inserted AS (
       INSERT INTO arsy_deployment_operation_events
         (operation_id, owner_id, sequence, event_type, from_status,
          to_status, actor_id, details)
       SELECT id, owner_id, 1, 'operation.queued', NULL, 'queued',
         actor_id, jsonb_build_object('kind', kind, 'requestHash', request_hash)
       FROM inserted
       RETURNING operation_id
     ),
     outbox_inserted AS (
       INSERT INTO arsy_deployment_outbox
         (id, operation_id, owner_id, event_type, payload)
       SELECT $9, id, owner_id, 'deployment.operation.queued',
         jsonb_build_object('operationId', id, 'deploymentId', deployment_id, 'kind', kind)
       FROM inserted
       RETURNING operation_id
     )
     SELECT id, deployment_id, owner_id, actor_id, kind, status,
       idempotency_key, request_hash, request_payload, attempt_count,
       created_at, updated_at
     FROM inserted`,
    [
      operationId,
      deploymentId,
      ownerId,
      actorId,
      input.kind,
      idempotencyKey,
      requestHash,
      requestPayloadJson,
      outboxId,
    ],
  )
  const created = queryRows<DeploymentOperationRow>(inserted)[0]
  if (created) return { disposition: 'created', operation: created }

  // Use a new statement/snapshot after ON CONFLICT DO NOTHING. This is safe
  // under concurrent inserts and avoids relying on an invisible conflict row
  // in the original statement snapshot.
  const priorResult = await pool.query(
    `SELECT id, deployment_id, owner_id, actor_id, kind, status,
       idempotency_key, request_hash, request_payload, attempt_count,
       created_at, updated_at
     FROM arsy_deployment_operations
     WHERE owner_id = $1 AND idempotency_key = $2`,
    [ownerId, idempotencyKey],
  )
  const prior = queryRows<DeploymentOperationRow>(priorResult)[0]
  if (!prior) throw new Error('Conflicting deployment operation could not be read')
  if (prior.request_hash !== requestHash) throw new IdempotencyConflictError()
  return { disposition: 'replayed', operation: prior }
}

export async function transitionDeploymentOperation(
  pool: DatabasePool,
  input: {
    operationId: string
    ownerId: string
    actorId: string
    expectedStatus: DeploymentOperationStatus
    nextStatus: DeploymentOperationStatus
    eventType: string
    details?: JsonObject
    errorCode?: string | null
  },
): Promise<DeploymentOperationRow> {
  assertOperationTransition(input.expectedStatus, input.nextStatus)
  const operationId = requiredText(input.operationId, 'operationId', 64)
  const ownerId = requiredText(input.ownerId, 'ownerId', 128)
  const actorId = requiredText(input.actorId, 'actorId', 128)
  const eventType = requiredText(input.eventType, 'eventType', 100)
  const details = canonicalJson(input.details ?? {})
  const errorCode = input.errorCode?.trim() || null
  if (errorCode && errorCode.length > 120) throw new TypeError('errorCode exceeds 120 characters')

  const result = await pool.query(
    `WITH changed AS (
       UPDATE arsy_deployment_operations
       SET status = $4,
           updated_at = now(),
           started_at = CASE WHEN $4 = 'running' THEN COALESCE(started_at, now()) ELSE started_at END,
           completed_at = CASE WHEN $4 IN ('succeeded', 'failed', 'cancelled', 'blocked') THEN now() ELSE NULL END,
           error_code = $8
       WHERE id = $1 AND owner_id = $2 AND status = $3
       RETURNING id, deployment_id, owner_id, actor_id, kind, status,
         idempotency_key, request_hash, request_payload, attempt_count,
         created_at, updated_at
     ),
     event_inserted AS (
       INSERT INTO arsy_deployment_operation_events
         (operation_id, owner_id, sequence, event_type, from_status,
          to_status, actor_id, details)
       SELECT changed.id, changed.owner_id,
         COALESCE((SELECT MAX(sequence) + 1
           FROM arsy_deployment_operation_events
           WHERE operation_id = changed.id), 1),
         $5, $3, $4, $6, $7::jsonb
       FROM changed
       RETURNING operation_id
     )
     SELECT id, deployment_id, owner_id, actor_id, kind, status,
       idempotency_key, request_hash, request_payload, attempt_count,
       created_at, updated_at
     FROM changed`,
    [operationId, ownerId, input.expectedStatus, input.nextStatus, eventType, actorId, details, errorCode],
  )
  const row = queryRows<DeploymentOperationRow>(result)[0]
  if (!row) throw new OperationStateConflictError()
  return row
}
