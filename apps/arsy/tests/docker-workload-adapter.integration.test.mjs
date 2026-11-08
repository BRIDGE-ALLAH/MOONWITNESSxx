import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import {
  DockerWorkloadAdapter,
  NodeDockerWorkloadTransport,
} from '../src/deployments/docker-workload-adapter.ts'

const execFileAsync = promisify(execFile)
const enabled = process.env.DOCKER_WORKLOAD_INTEGRATION === '1'
const image = process.env.TEST_DOCKER_WORKLOAD_IMAGE
const socketPath = process.env.DOCKER_LOCAL_SOCKET_PATH ?? '/var/run/docker.sock'

test(
  'real Docker Engine creates only owner-labelled containers and preserves named volumes',
  {
    skip:
      !enabled || !image
        ? 'Set DOCKER_WORKLOAD_INTEGRATION=1 and TEST_DOCKER_WORKLOAD_IMAGE to run the disposable Engine test'
        : false,
  },
  async () => {
    assert.match(image, /@sha256:[a-f0-9]{64}$/)
    const connection = { kind: 'local', socketPath }
    const transport = new NodeDockerWorkloadTransport()
    const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
    const ownerId = `docker-ci-${randomUUID()}`
    const deploymentId = randomUUID()
    const operationId = randomUUID()
    const scope = { ownerId, deploymentId, operationId }
    const ownerHash = createHash('sha256').update(ownerId).digest('hex').slice(0, 16)
    let containerId = null
    const volumeName = `mw-${ownerHash}-${deploymentId.slice(0, 8)}-data`

    try {
      const receipt = await adapter.create(connection, {
        ...scope,
        name: 'integration-app',
        image,
        exposedPorts: [8080],
        volumes: [{ key: 'data', target: '/data/content' }],
        resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
      })
      containerId = receipt.containerId
      assert.equal(receipt.volumeNames[0], volumeName)
      assert.match(containerId, /^[a-f0-9]{64}$/)
      assert.equal(receipt.image, image)

      const inspected = await adapter.inspect(connection, scope, containerId)
      assert.ok(inspected)
      assert.equal(inspected.containerId, containerId)
      assert.equal(inspected.labels['io.moonwitness.managed-by'], 'arsy-deployment-adapter')
      assert.equal(inspected.labels['io.moonwitness.owner-hash'], ownerHash)
      assert.equal(inspected.labels['io.moonwitness.deployment-id'], deploymentId)
      assert.deepEqual(inspected.volumeNames, [volumeName])

      // The adapter may remove the container but exposes no volume-delete method.
      assert.equal(await adapter.remove(connection, scope, containerId), true)
      containerId = null
      const volume = await transport.request(connection, {
        method: 'GET',
        path: `/volumes/${encodeURIComponent(volumeName)}`,
      })
      assert.equal(volume.statusCode, 200)
      assert.equal(volume.body.Labels['io.moonwitness.owner-hash'], ownerHash)
      assert.equal(volume.body.Labels['io.moonwitness.deployment-id'], deploymentId)
    } finally {
      if (containerId) {
        try {
          const inspected = await adapter.inspect(connection, scope, containerId)
          if (inspected && !inspected.running) await adapter.remove(connection, scope, containerId)
          else if (inspected?.running) {
            await adapter.stop(connection, scope, containerId, 5)
            await adapter.remove(connection, scope, containerId)
          }
        } catch {
          // Preserve the original integration failure; never delete an unverified container.
        }
      }
      const leftoverVolume = await transport.request(connection, {
        method: 'GET',
        path: `/volumes/${encodeURIComponent(volumeName)}`,
      })
      if (leftoverVolume.statusCode === 200) {
        const labels = leftoverVolume.body?.Labels
        if (
          labels?.['io.moonwitness.managed-by'] === 'arsy-deployment-adapter' &&
          labels?.['io.moonwitness.owner-hash'] === ownerHash &&
          labels?.['io.moonwitness.deployment-id'] === deploymentId
        ) {
          await execFileAsync('docker', ['volume', 'rm', volumeName])
        } else {
          throw new Error(
            'Integration test refused to delete a volume without exact ownership labels'
          )
        }
      } else if (leftoverVolume.statusCode !== 404) {
        throw new Error(
          `Integration volume cleanup could not inspect the volume (HTTP ${leftoverVolume.statusCode})`
        )
      }
    }
  }
)
