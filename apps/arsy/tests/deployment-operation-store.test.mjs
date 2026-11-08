import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDeployment,
  createDeploymentOperation,
  IdempotencyConflictError,
} from '../src/deployments/operation-store.ts'

class FakePool {
  deployments = []
  operations = []
  events = []
  outbox = []

  async query(statement, values = []) {
    if (statement.includes('INSERT INTO arsy_deployments')) {
      const row = {
        id: values[0], owner_id: values[1], docker_server_id: values[2],
        name: values[3], desired_image_digest: values[4],
        desired_config: JSON.parse(values[5]), created_by: values[6],
        status: 'draft', created_at: '2026-11-08T00:00:00.000Z',
        updated_at: '2026-11-08T00:00:00.000Z',
      }
      this.deployments.push(row)
      return { rows: [row] }
    }
    if (statement.includes('WITH inserted AS')) {
      const [id, deploymentId, ownerId, actorId, kind, idempotencyKey, requestHash, requestPayload, outboxId] = values
      const existing = this.operations.find(row => row.owner_id === ownerId && row.idempotency_key === idempotencyKey)
      if (existing) return { rows: [] }
      const row = {
        id, deployment_id: deploymentId, owner_id: ownerId, actor_id: actorId,
        kind, status: 'queued', idempotency_key: idempotencyKey,
        request_hash: requestHash, request_payload: JSON.parse(requestPayload),
        attempt_count: 0, created_at: '2026-11-08T00:00:00.000Z',
        updated_at: '2026-11-08T00:00:00.000Z',
      }
      this.operations.push(row)
      this.events.push({ operation_id: id, sequence: 1 })
      this.outbox.push({ id: outboxId, operation_id: id })
      return { rows: [row] }
    }
    if (statement.includes('FROM arsy_deployment_operations')) {
      const row = this.operations.find(item => item.owner_id === values[0] && item.idempotency_key === values[1])
      return { rows: row ? [row] : [] }
    }
    throw new Error('Unexpected SQL in fake pool')
  }
}

const base = {
  ownerId: 'operator-1',
  actorId: 'operator-1',
  deploymentId: '11111111-1111-4111-8111-111111111111',
  kind: 'deploy',
  idempotencyKey: 'deploy-request-0001',
  requestPayload: { imageDigest: `sha256:${'a'.repeat(64)}` },
}

test('deployment store persists an owner-scoped deployment and desired metadata', async () => {
  const pool = new FakePool()
  const deployment = await createDeployment(pool, {
    ownerId: 'operator-1',
    actorId: 'operator-1',
    dockerServerId: '22222222-2222-4222-8222-222222222222',
    name: 'web-app',
    desiredImageDigest: `sha256:${'a'.repeat(64)}`,
    desiredConfig: { port: 8080, secretRefs: ['vault://web/db'] },
  })
  assert.equal(deployment.owner_id, 'operator-1')
  assert.equal(deployment.name, 'web-app')
  assert.equal(deployment.status, 'draft')
})

test('operation creation is idempotent and writes one event and outbox item', async () => {
  const pool = new FakePool()
  const created = await createDeploymentOperation(pool, base)
  const replayed = await createDeploymentOperation(pool, base)
  assert.equal(created.disposition, 'created')
  assert.equal(replayed.disposition, 'replayed')
  assert.equal(replayed.operation.id, created.operation.id)
  assert.equal(pool.operations.length, 1)
  assert.equal(pool.events.length, 1)
  assert.equal(pool.outbox.length, 1)
})

test('reusing an idempotency key for a different request is rejected', async () => {
  const pool = new FakePool()
  await createDeploymentOperation(pool, base)
  await assert.rejects(
    createDeploymentOperation(pool, { ...base, requestPayload: { imageDigest: `sha256:${'b'.repeat(64)}` } }),
    IdempotencyConflictError,
  )
  assert.equal(pool.operations.length, 1)
  assert.equal(pool.events.length, 1)
  assert.equal(pool.outbox.length, 1)
})
