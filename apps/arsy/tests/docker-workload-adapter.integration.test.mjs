import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  DockerWorkloadAdapter,
  DockerWorkloadOwnershipError,
  NodeDockerWorkloadTransport,
} from '../src/deployments/docker-workload-adapter.ts'

const enabled = process.env.DOCKER_WORKLOAD_SMOKE === '1' &&
  process.env.DOCKER_WORKLOAD_TEST_IMAGE &&
  existsSync('/var/run/docker.sock')

test('workload adapter creates, scopes, starts, stops and removes only its disposable real Docker container', {
  skip: !enabled && 'Disposable Docker workload smoke test is not enabled on this runner',
  timeout: 60_000,
}, async () => {
  const image = process.env.DOCKER_WORKLOAD_TEST_IMAGE
  assert.match(image, /^.+@sha256:[a-f0-9]{64}$/)
  const adapter = new DockerWorkloadAdapter({
    enabled: true,
    transport: new NodeDockerWorkloadTransport({ timeoutMs: 10_000 }),
  })
  const connection = { kind: 'local', socketPath: '/var/run/docker.sock' }
  const scope = {
    ownerId: `ci-workload-${randomUUID()}`,
    deploymentId: randomUUID(),
    operationId: randomUUID(),
  }
  const name = `mw-ci-${randomUUID().replaceAll('-', '').slice(0, 24)}`
  let containerId

  try {
    const receipt = await adapter.create(connection, {
      ...scope,
      name,
      image,
      resources: { memoryBytes: 128 * 1024 * 1024, nanoCpus: 100_000_000 },
    })
    containerId = receipt.containerId
    assert.equal(receipt.image, image)

    await assert.rejects(
      adapter.inspect(connection, { ...scope, ownerId: 'another-owner' }, containerId),
      DockerWorkloadOwnershipError,
    )

    await adapter.start(connection, scope, containerId)
    const running = await adapter.inspect(connection, scope, containerId)
    assert.equal(running.running, true)
    assert.equal(running.labels['io.moonwitness.deployment-id'], scope.deploymentId)
    assert.equal(running.labels['io.moonwitness.operation-id'], scope.operationId)

    await adapter.stop(connection, scope, containerId, 10)
    const stopped = await adapter.inspect(connection, scope, containerId)
    assert.equal(stopped.running, false)
    assert.equal(await adapter.remove(connection, scope, containerId), true)
    containerId = undefined
  } finally {
    if (containerId) {
      try { await adapter.stop(connection, scope, containerId, 5) } catch {}
      try { await adapter.remove(connection, scope, containerId) } catch {}
    }
  }
})
