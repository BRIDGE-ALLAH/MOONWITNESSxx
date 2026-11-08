import type { DatabasePool } from '../db.ts'
import {
  acknowledgeDeploymentOutbox,
  claimDeploymentOutbox,
  retryDeploymentOutbox,
  type ClaimOutboxInput,
  type ClaimedDeploymentOutboxMessage,
  type DeploymentOutboxMessage,
} from './outbox-store.ts'

export type DeploymentOutboxHandler = (message: DeploymentOutboxMessage) => Promise<void>

export interface DispatchOutboxInput extends ClaimOutboxInput {
  handlers: Readonly<Record<string, DeploymentOutboxHandler>>
}

export interface DispatchOutboxResult {
  claimed: number
  delivered: number
  retryScheduled: number
  deadLettered: number
  leaseLost: number
}

function safeErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'handler_failed'
  const candidate = (error as { code?: unknown }).code
  return typeof candidate === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(candidate)
    ? candidate
    : 'handler_failed'
}

function handlerMessage(message: ClaimedDeploymentOutboxMessage): DeploymentOutboxMessage {
  return {
    id: message.id,
    operationId: message.operationId,
    ownerId: message.ownerId,
    eventType: message.eventType,
    payload: message.payload,
    attemptCount: message.attemptCount,
    maxAttempts: message.maxAttempts,
    createdAt: message.createdAt,
  }
}

/**
 * Performs one bounded, at-least-once dispatch pass. It is deliberately not
 * wired into ARSY startup. Handlers must be idempotent by message.id because
 * a worker can finish a side effect and lose its lease before acking.
 */
export async function dispatchDeploymentOutboxBatch(
  pool: DatabasePool,
  input: DispatchOutboxInput,
): Promise<DispatchOutboxResult> {
  const claimed = await claimDeploymentOutbox(pool, input)
  const result: DispatchOutboxResult = {
    claimed: claimed.length,
    delivered: 0,
    retryScheduled: 0,
    deadLettered: 0,
    leaseLost: 0,
  }

  for (const message of claimed) {
    const handler = input.handlers[message.eventType]
    if (!handler) {
      const retry = await retryDeploymentOutbox(pool, message, 'handler_not_registered')
      if (retry === 'retry_scheduled') result.retryScheduled += 1
      else if (retry === 'dead_lettered') result.deadLettered += 1
      else result.leaseLost += 1
      continue
    }

    try {
      await handler(handlerMessage(message))
    } catch (error) {
      const retry = await retryDeploymentOutbox(pool, message, safeErrorCode(error))
      if (retry === 'retry_scheduled') result.retryScheduled += 1
      else if (retry === 'dead_lettered') result.deadLettered += 1
      else result.leaseLost += 1
      continue
    }

    if (await acknowledgeDeploymentOutbox(pool, message)) result.delivered += 1
    else result.leaseLost += 1
  }

  return result
}
