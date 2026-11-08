import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  DockerWorkloadAdapter,
  DockerWorkloadDisabledError,
  DockerWorkloadOwnershipError,
  DockerWorkloadTransportError,
  NodeDockerWorkloadTransport,
} from '../src/deployments/docker-workload-adapter.ts'

const ownerId = 'operator-1'
const deploymentId = '11111111-1111-4111-8111-111111111111'
const operationId = '22222222-2222-4222-8222-222222222222'
const containerId = 'a'.repeat(64)
const digest = 'sha256:' + 'b'.repeat(64)
const image = `docker.io/library/nginx@${digest}`
const connection = { kind: 'local', socketPath: '/var/run/docker.sock' }

function scopedLabels(owner = ownerId, deployment = deploymentId, operation = operationId) {
  const ownerHash = createHash('sha256').update(owner).digest('hex').slice(0, 16)
  return {
    'io.moonwitness.managed-by': 'arsy-deployment-adapter',
    'io.moonwitness.owner-hash': ownerHash,
    'io.moonwitness.deployment-id': deployment,
    'io.moonwitness.operation-id': operation,
  }
}

class FakeTransport {
  calls = []
  queue = []

  async request(_connection, request) {
    this.calls.push(request)
    const next = this.queue.shift()
    if (!next) throw new Error(`Unexpected Docker request: ${request.method} ${request.path}`)
    if (next instanceof Error) throw next
    return next
  }
}

function response(statusCode, body = null) { return { statusCode, body } }

test('mutations are disabled by default and require an explicit trusted feature gate', async () => {
  const adapter = new DockerWorkloadAdapter({ enabled: false, transport: new FakeTransport() })
  await assert.rejects(
    adapter.create(connection, {
      ownerId, deploymentId, operationId, name: 'web',
      image, resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
    }),
    DockerWorkloadDisabledError,
  )
})

test('create validates immutable image digests, public env, resource bounds and volume targets', async () => {
  const transport = new FakeTransport()
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  const invalid = [
    { image: 'docker.io/library/nginx:latest' },
    { image: 'docker.io/library/nginx@sha256:abcd' },
  ]
  for (const value of invalid) {
    await assert.rejects(adapter.create(connection, {
      ownerId, deploymentId, operationId, name: 'web',
      image: value.image,
      resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
    }), /immutable sha256 digest/)
  }
  await assert.rejects(adapter.create(connection, {
    ownerId, deploymentId, operationId, name: 'web', image,
    publicEnvironment: { DATABASE_PASSWORD: 'secret' },
    resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
  }), /PUBLIC_\*/)
  await assert.rejects(adapter.create(connection, {
    ownerId, deploymentId, operationId, name: 'web', image,
    publicEnvironment: { PUBLIC_MODE: `line${String.fromCharCode(10)}break` },
    resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
  }), /invalid or exceeds 4 KiB/)
  await assert.rejects(adapter.create(connection, {
    ownerId, deploymentId, operationId, name: 'web', image,
    resources: { memoryBytes: 32 * 1024 * 1024, nanoCpus: 500_000_000 },
  }), /128 MiB/)
  await assert.rejects(adapter.create(connection, {
    ownerId, deploymentId, operationId, name: 'web', image,
    volumes: [{ key: 'data', target: '/etc/nginx' }],
    resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
  }), /below \/data/)
  assert.equal(transport.calls.length, 0)
})

test('create uses a pinned image, private network defaults, no host binds and owner-bound persistent volumes', async () => {
  const transport = new FakeTransport()
  transport.queue.push(
    response(404),
    response(201, { Name: 'created-volume' }),
    response(201, { Id: containerId, Warnings: [] }),
  )
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  const receipt = await adapter.create(connection, {
    ownerId, deploymentId, operationId, name: 'web',
    image,
    publicEnvironment: { PUBLIC_MODE: 'production' },
    exposedPorts: [8080],
    volumes: [{ key: 'content', target: '/data/content' }],
    resources: { memoryBytes: 512 * 1024 * 1024, nanoCpus: 1_000_000_000 },
  })

  assert.equal(receipt.containerId, containerId)
  assert.equal(receipt.image, image)
  assert.equal(receipt.volumeNames.length, 1)
  assert.equal(transport.calls[0].path.startsWith('/volumes/'), true)
  assert.equal(transport.calls[1].path, '/volumes/create')
  assert.equal(transport.calls[1].body.Driver, 'local')
  assert.equal(transport.calls[1].body.Labels['io.moonwitness.deployment-id'], deploymentId)

  const create = transport.calls[2]
  assert.equal(create.method, 'POST')
  assert.equal(create.path.startsWith('/containers/create?name='), true)
  assert.equal(create.body.Image, image)
  assert.deepEqual(create.body.Env, ['PUBLIC_MODE=production'])
  assert.equal(create.body.HostConfig.NetworkMode, 'bridge')
  assert.equal(create.body.HostConfig.Privileged, false)
  assert.equal(create.body.HostConfig.ReadonlyRootfs, true)
  assert.deepEqual(create.body.HostConfig.CapDrop, ['ALL'])
  assert.deepEqual(create.body.HostConfig.SecurityOpt, ['no-new-privileges:true'])
  assert.equal(create.body.HostConfig.PortBindings, undefined)
  assert.equal(create.body.HostConfig.Binds, undefined)
  assert.equal(create.body.HostConfig.Mounts[0].Type, 'volume')
  assert.equal(create.body.HostConfig.Mounts[0].Source, receipt.volumeNames[0])
  assert.equal(create.body.HostConfig.Mounts[0].Target, '/data/content')
  assert.equal(create.body.HostConfig.Mounts[0].ReadOnly, false)
  assert.equal(create.body.Labels['io.moonwitness.owner-hash'], scopedLabels()['io.moonwitness.owner-hash'])
})

test('start and stop require managed deployment labels and use bounded Engine operations', async () => {
  const transport = new FakeTransport()
  transport.queue.push(
    response(200, {
      Id: containerId,
      Config: { Image: image, Labels: scopedLabels() },
      State: { Status: 'created', Running: false },
      Mounts: [],
    }),
    response(204),
    response(200, {
      Id: containerId,
      Config: { Image: image, Labels: scopedLabels() },
      State: { Status: 'running', Running: true },
      Mounts: [],
    }),
    response(204),
  )
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  await adapter.start(connection, { ownerId, deploymentId, operationId }, containerId)
  await adapter.stop(connection, { ownerId, deploymentId, operationId }, containerId, 10)
  assert.equal(transport.calls[1].path, `/containers/${containerId}/start`)
  assert.equal(transport.calls[3].path, `/containers/${containerId}/stop?t=10`)
})

test('foreign deployment containers cannot be started, stopped or removed', async () => {
  const transport = new FakeTransport()
  transport.queue.push(response(200, {
    Id: containerId,
    Config: { Image: image, Labels: scopedLabels('different-owner') },
    State: { Status: 'running', Running: true },
    Mounts: [],
  }))
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  await assert.rejects(
    adapter.stop(connection, { ownerId, deploymentId, operationId }, containerId),
    DockerWorkloadOwnershipError,
  )
  assert.equal(transport.calls.length, 1)
})

test('remove is restricted to stopped managed containers and explicitly preserves volumes', async () => {
  const transport = new FakeTransport()
  transport.queue.push(
    response(200, {
      Id: containerId,
      Config: { Image: image, Labels: scopedLabels() },
      State: { Status: 'exited', Running: false },
      Mounts: [{ Type: 'volume', Name: 'mw-volume' }],
    }),
    response(204),
  )
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  assert.equal(await adapter.remove(connection, { ownerId, deploymentId, operationId }, containerId), true)
  assert.equal(transport.calls[1].method, 'DELETE')
  assert.equal(transport.calls[1].path, `/containers/${containerId}?v=0&force=0`)
  assert.equal(transport.calls.some((call) => call.path.startsWith('/volumes/') && call.method === 'DELETE'), false)
})

test('remove cannot delete a running container', async () => {
  const transport = new FakeTransport()
  transport.queue.push(response(200, {
    Id: containerId,
    Config: { Image: image, Labels: scopedLabels() },
    State: { Status: 'running', Running: true },
    Mounts: [],
  }))
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  await assert.rejects(
    adapter.remove(connection, { ownerId, deploymentId, operationId }, containerId),
    /Stop a managed container before removing it/,
  )
  assert.equal(transport.calls.length, 1)
})

test('unexpected or ambiguous provider outcomes are not silently retried', async () => {
  const transport = new FakeTransport()
  transport.queue.push(new DockerWorkloadTransportError('timed out after submit', { outcomeUnknown: true }))
  const adapter = new DockerWorkloadAdapter({ enabled: true, transport })
  await assert.rejects(
    adapter.create(connection, {
      ownerId, deploymentId, operationId, name: 'web', image,
      resources: { memoryBytes: 256 * 1024 * 1024, nanoCpus: 500_000_000 },
    }),
    (error) => error instanceof DockerWorkloadTransportError && error.outcomeUnknown,
  )
  assert.equal(transport.calls.length, 1)
})

test('transport rejects arbitrary Engine API paths before opening a socket', async () => {
  const transport = new NodeDockerWorkloadTransport()
  await assert.rejects(
    transport.request(connection, { method: 'POST', path: '/containers/evil/exec?cmd=id' }),
    /unsupported Engine API path/,
  )
})
