import http from 'node:http'
import https from 'node:https'
import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import type { IncomingMessage } from 'node:http'
import type { DockerConnection } from '../docker/engine.ts'

const MANAGED_LABEL = 'io.moonwitness.managed-by'
const OWNER_LABEL = 'io.moonwitness.owner-hash'
const DEPLOYMENT_LABEL = 'io.moonwitness.deployment-id'
const OPERATION_LABEL = 'io.moonwitness.operation-id'
const VOLUME_LABEL = 'io.moonwitness.volume-key'
const MANAGED_BY = 'arsy-deployment-adapter'
const MAX_BODY_BYTES = 128 * 1024
const MAX_RESPONSE_BYTES = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 10_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTAINER_ID = /^[a-f0-9]{12,64}$/i

export interface DockerWorkloadRequest {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  timeoutMs?: number
}

export interface DockerWorkloadResponse {
  statusCode: number
  body: unknown
}

export interface DockerWorkloadTransport {
  request(connection: DockerConnection, request: DockerWorkloadRequest): Promise<DockerWorkloadResponse>
}

export class DockerWorkloadTransportError extends Error {
  readonly outcomeUnknown: boolean
  readonly statusCode?: number

  constructor(message: string, options: { outcomeUnknown: boolean; statusCode?: number }) {
    super(message)
    this.name = 'DockerWorkloadTransportError'
    this.outcomeUnknown = options.outcomeUnknown
    this.statusCode = options.statusCode
  }
}

function assertEnginePath(path: string): void {
  if (path.length > 2048 || path.includes('\\') || /[\\r\\n]/.test(path) ||
      !(/^\\/containers\\/create(?:\\?|$)/.test(path) ||
        /^\\/containers\\/[a-f0-9]{12,64}(?:\\/(?:json|start|stop))?(?:\\?|$)/i.test(path) ||
        /^\\/volumes\\/create$/.test(path) ||
        /^\\/volumes\\/[a-z0-9][a-z0-9_.-]{0,180}$/.test(path))) {
    throw new TypeError('Docker workload adapter rejected an unsupported Engine API path')
  }
}

function parseResponseBody(buffer: Buffer): unknown {
  if (buffer.length === 0) return null
  const text = buffer.toString('utf8')
  try { return JSON.parse(text) as unknown } catch { return text }
}

/** Internal transport with the Docker connector's pinned TLS/DNS boundary. */
export class NodeDockerWorkloadTransport implements DockerWorkloadTransport {
  async request(
    connection: DockerConnection,
    input: DockerWorkloadRequest,
  ): Promise<DockerWorkloadResponse> {
    assertEnginePath(input.path)
    const bodyText = input.body === undefined ? undefined : JSON.stringify(input.body)
    const body = bodyText === undefined ? undefined : Buffer.from(bodyText, 'utf8')
    if (body && body.length > MAX_BODY_BYTES) {
      throw new DockerWorkloadTransportError('Docker workload request exceeds 128 KiB', { outcomeUnknown: false })
    }

    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 30_000) {
      throw new TypeError('Docker workload timeout must be between 250 and 30000 ms')
    }

    const remoteUrl = connection.kind === 'remote' ? new URL(connection.endpointUrl) : null
    if (connection.kind === 'local' && connection.socketPath !== '/var/run/docker.sock' && connection.socketPath !== '/run/docker.sock') {
      throw new DockerWorkloadTransportError('Local Docker socket path is not allowed', { outcomeUnknown: false })
    }
    let pinnedLookup: https.RequestOptions['lookup']
    if (connection.kind === 'remote') {
      if (remoteUrl?.protocol !== 'https:' || remoteUrl.username || remoteUrl.password ||
          (remoteUrl.pathname !== '/' && remoteUrl.pathname !== '') || remoteUrl.search || remoteUrl.hash ||
          (remoteUrl.port && remoteUrl.port !== '2376') || connection.addresses.length === 0 ||
          connection.addresses.some((address) => isIP(address.address) !== address.family)) {
        throw new DockerWorkloadTransportError('Remote Docker connection is not a validated HTTPS origin', { outcomeUnknown: false })
      }
      pinnedLookup = ((_hostname, options, callback) => {
        const lookupOptions = typeof options === 'object' && options ? options : {}
        const family = lookupOptions.family ?? 0
        const candidates = connection.addresses.filter((address) => !family || address.family === family)
        if (candidates.length === 0) {
          const error = new Error('Docker endpoint has no validated pinned address')
          return lookupOptions.all ? callback(error, []) : callback(error, '', 0)
        }
        if (lookupOptions.all) callback(null, candidates.map(({ address, family: addressFamily }) => ({ address, family: addressFamily })))
        else callback(null, candidates[0].address, candidates[0].family)
      }) as NonNullable<https.RequestOptions['lookup']>
    }

    const headers: Record<string, string | number> = { Accept: 'application/json' }
    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = body.length
    }
    const options: http.RequestOptions & https.RequestOptions = connection.kind === 'local'
      ? {
          socketPath: connection.socketPath,
          path: input.path,
          method: input.method,
          headers,
        }
      : {
          hostname: remoteUrl!.hostname,
          port: remoteUrl!.port || 2376,
          path: input.path,
          method: input.method,
          headers,
          ca: connection.tls.ca,
          cert: connection.tls.cert,
          key: connection.tls.key,
          rejectUnauthorized: true,
          servername: remoteUrl!.hostname,
          lookup: pinnedLookup,
        }

    return new Promise((resolve, reject) => {
      let submitted = false
      const onResponse = (response: IncomingMessage) => {
        const statusCode = response.statusCode ?? 0
        let size = 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy(new Error('Docker workload response exceeds 1 MiB'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => resolve({
          statusCode,
          body: parseResponseBody(Buffer.concat(chunks)),
        }))
        response.on('error', (error) => reject(new DockerWorkloadTransportError(
          error.message,
          { outcomeUnknown: submitted, statusCode },
        )))
      }

      const request = connection.kind === 'remote'
        ? https.request(options as https.RequestOptions, onResponse)
        : http.request(options as http.RequestOptions, onResponse)
      request.setTimeout(timeoutMs, () => request.destroy(new Error('Docker workload Engine request timed out')))
      request.on('error', (error) => reject(new DockerWorkloadTransportError(
        error.message,
        { outcomeUnknown: submitted },
      )))
      submitted = true
      request.end(body)
    })
  }
}

export interface DockerWorkloadScope {
  ownerId: string
  deploymentId: string
  operationId: string
}

export interface DockerWorkloadVolume {
  key: string
  target: string
  readOnly?: boolean
}

export interface DockerWorkloadResources {
  memoryBytes: number
  nanoCpus: number
}

export interface CreateDockerWorkloadInput extends DockerWorkloadScope {
  name: string
  image: string
  publicEnvironment?: Record<string, string>
  exposedPorts?: number[]
  volumes?: DockerWorkloadVolume[]
  resources: DockerWorkloadResources
}

export interface DockerWorkloadReceipt {
  containerId: string
  containerName: string
  image: string
  labels: Record<string, string>
  volumeNames: string[]
}

export interface DockerWorkloadInspection {
  containerId: string
  image: string
  state: string
  running: boolean
  labels: Record<string, string>
  volumeNames: string[]
}

export interface DockerWorkloadPort {
  create(connection: DockerConnection, input: CreateDockerWorkloadInput): Promise<DockerWorkloadReceipt>
  inspect(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<DockerWorkloadInspection | null>
  start(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<void>
  stop(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string, graceSeconds?: number): Promise<void>
  remove(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<boolean>
}

export class DockerWorkloadDisabledError extends Error {
  constructor() {
    super('Docker workload mutations are disabled; set the trusted deployment feature gate before use')
    this.name = 'DockerWorkloadDisabledError'
  }
}

export class DockerWorkloadOwnershipError extends Error {
  constructor() {
    super('Docker container is not owned by the requested ARSY deployment')
    this.name = 'DockerWorkloadOwnershipError'
  }
}

function requiredText(value: string, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new TypeError(`${field} must contain 1-${max} characters`)
  }
  return value.trim()
}

function ownerHash(ownerId: string): string {
  return createHash('sha256').update(ownerId, 'utf8').digest('hex').slice(0, 16)
}

function assertScope(scope: DockerWorkloadScope): void {
  requiredText(scope.ownerId, 'ownerId', 128)
  if (!UUID.test(scope.deploymentId)) throw new TypeError('deploymentId must be a UUID')
  if (!UUID.test(scope.operationId)) throw new TypeError('operationId must be a UUID')
}

function labelsFor(scope: DockerWorkloadScope): Record<string, string> {
  return {
    [MANAGED_LABEL]: MANAGED_BY,
    [OWNER_LABEL]: ownerHash(scope.ownerId),
    [DEPLOYMENT_LABEL]: scope.deploymentId,
    [OPERATION_LABEL]: scope.operationId,
  }
}

function assertImageReference(image: string): string {
  const value = requiredText(image, 'image', 512)
  const pattern = /^(?:(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::[1-9][0-9]{0,4})?\\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*@sha256:[a-f0-9]{64}$/
  if (!pattern.test(value)) throw new TypeError('Docker workload image must be a repository pinned to an immutable sha256 digest')
  return value
}

function containerName(input: CreateDockerWorkloadInput): string {
  const name = requiredText(input.name, 'name', 80).toLowerCase()
  if (!/^[a-z0-9][a-z0-9_.-]{0,62}$/.test(name)) {
    throw new TypeError('Deployment name must use lowercase Docker-safe characters')
  }
  return `mw-${ownerHash(input.ownerId)}-${input.deploymentId.slice(0, 8)}-${name.slice(0, 32)}-${input.operationId.slice(0, 8)}`
}

function normalizeEnvironment(input: Record<string, string> | undefined): string[] {
  if (!input) return []
  const entries = Object.entries(input)
  if (entries.length > 32) throw new TypeError('At most 32 public environment values may be declared')
  let bytes = 0
  const result = entries.map(([key, value]) => {
    if (!/^PUBLIC_[A-Z0-9_]{1,60}$/.test(key)) {
      throw new TypeError('Only explicitly public PUBLIC_* environment variables are allowed')
    }
    if (typeof value !== 'string' || value.length > 4096 || /[\\0\\r\\n]/.test(value)) {
      throw new TypeError(`Public environment value ${key} is invalid or exceeds 4 KiB`)
    }
    bytes += Buffer.byteLength(key, 'utf8') + Buffer.byteLength(value, 'utf8')
    return `${key}=${value}`
  })
  if (bytes > 16 * 1024) throw new TypeError('Public environment values exceed 16 KiB')
  return result
}

function normalizePorts(ports: number[] | undefined): Record<string, Record<string, never>> {
  const result: Record<string, Record<string, never>> = {}
  if (!ports) return result
  if (ports.length > 8) throw new TypeError('At most eight container ports may be declared')
  const seen = new Set<number>()
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError('Exposed container ports must be integers from 1 to 65535')
    }
    if (seen.has(port)) throw new TypeError('Exposed container ports must be unique')
    seen.add(port)
    result[`${port}/tcp`] = {}
  }
  return result
}

function normalizeResources(value: DockerWorkloadResources): DockerWorkloadResources {
  if (!Number.isSafeInteger(value.memoryBytes) || value.memoryBytes < 128 * 1024 * 1024 ||
      value.memoryBytes > 16 * 1024 * 1024 * 1024) {
    throw new TypeError('Container memory must be between 128 MiB and 16 GiB')
  }
  if (!Number.isSafeInteger(value.nanoCpus) || value.nanoCpus < 100_000_000 ||
      value.nanoCpus > 8_000_000_000) {
    throw new TypeError('Container CPU must be between 0.1 and 8 CPUs')
  }
  return value
}

function volumeName(scope: DockerWorkloadScope, key: string): string {
  return `mw-${ownerHash(scope.ownerId)}-${scope.deploymentId.slice(0, 8)}-${key}`
}

function normalizeVolumes(scope: DockerWorkloadScope, volumes: DockerWorkloadVolume[] | undefined): Array<{
  key: string
  name: string
  target: string
  readOnly: boolean
  labels: Record<string, string>
}> {
  if (!volumes) return []
  if (volumes.length > 4) throw new TypeError('At most four named persistent volumes may be mounted')
  const seenKeys = new Set<string>()
  const seenTargets = new Set<string>()
  return volumes.map((volume) => {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,30})$/.test(volume.key)) {
      throw new TypeError('Volume keys must use lowercase alphanumeric and hyphen characters')
    }
    if (seenKeys.has(volume.key)) throw new TypeError('Volume keys must be unique')
    seenKeys.add(volume.key)
    if (!/^\\/data(?:\\/[a-zA-Z0-9._-]+)*$/.test(volume.target) ||
        volume.target.split('/').some((part) => part === '.' || part === '..') ||
        volume.target.length > 128) {
      throw new TypeError('Named volume targets must be paths below /data')
    }
    if (seenTargets.has(volume.target)) throw new TypeError('Volume targets must be unique')
    seenTargets.add(volume.target)
    const labels = {
      [MANAGED_LABEL]: MANAGED_BY,
      [OWNER_LABEL]: ownerHash(scope.ownerId),
      [DEPLOYMENT_LABEL]: scope.deploymentId,
      [VOLUME_LABEL]: volume.key,
    }
    return {
      key: volume.key,
      name: volumeName(scope, volume.key),
      target: volume.target,
      readOnly: volume.readOnly === true,
      labels,
    }
  })
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Docker Engine returned invalid ${field}`)
  }
  return value as Record<string, unknown>
}

function responseRecord(response: DockerWorkloadResponse, expected: number[], action: string): Record<string, unknown> {
  if (!expected.includes(response.statusCode)) {
    const engineMessage = typeof (response.body as Record<string, unknown> | null)?.message === 'string'
      ? String((response.body as Record<string, unknown>).message).slice(0, 300)
      : ''
    throw new DockerWorkloadTransportError(
      engineMessage ? `Docker Engine rejected ${action}: ${engineMessage}` : `Docker Engine rejected ${action} (HTTP ${response.statusCode})`,
      { outcomeUnknown: false, statusCode: response.statusCode },
    )
  }
  if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body)) {
    return {}
  }
  return response.body as Record<string, unknown>
}

export interface DockerWorkloadAdapterOptions {
  enabled: boolean
  transport?: DockerWorkloadTransport
}

/**
 * Narrow mutation adapter. It never accepts arbitrary Engine paths, labels,
 * host binds, privileged flags, host networking or volume deletion.
 */
export class DockerWorkloadAdapter implements DockerWorkloadPort {
  private readonly enabled: boolean
  private readonly transport: DockerWorkloadTransport

  constructor(options: DockerWorkloadAdapterOptions) {
    this.enabled = options.enabled
    this.transport = options.transport ?? new NodeDockerWorkloadTransport()
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new DockerWorkloadDisabledError()
  }

  private async ensureVolume(
    connection: DockerConnection,
    volume: ReturnType<typeof normalizeVolumes>[number],
  ): Promise<void> {
    const encoded = encodeURIComponent(volume.name)
    const existing = await this.transport.request(connection, {
      method: 'GET',
      path: `/volumes/${encoded}`,
    })
    if (existing.statusCode === 200) {
      const data = asRecord(existing.body, 'volume inspection')
      const labels = asRecord(asRecord(data.Labels, 'volume labels'), 'volume labels')
      for (const [key, value] of Object.entries(volume.labels)) {
        if (labels[key] !== value) throw new DockerWorkloadOwnershipError()
      }
      return
    }
    if (existing.statusCode !== 404) {
      throw new DockerWorkloadTransportError(
        `Docker Engine volume inspection failed (HTTP ${existing.statusCode})`,
        { outcomeUnknown: false, statusCode: existing.statusCode },
      )
    }

    const created = await this.transport.request(connection, {
      method: 'POST',
      path: '/volumes/create',
      body: { Name: volume.name, Driver: 'local', Labels: volume.labels },
    })
    if (![201, 409].includes(created.statusCode)) {
      responseRecord(created, [201], 'create persistent volume')
      return
    }
    if (created.statusCode === 409) {
      const raced = await this.transport.request(connection, { method: 'GET', path: `/volumes/${encoded}` })
      if (raced.statusCode !== 200) {
        throw new DockerWorkloadTransportError(
          'Docker volume creation conflicted and the resulting volume could not be inspected',
          { outcomeUnknown: true, statusCode: raced.statusCode },
        )
      }
      const data = asRecord(raced.body, 'volume inspection')
      const labels = asRecord(asRecord(data.Labels, 'volume labels'), 'volume labels')
      for (const [key, value] of Object.entries(volume.labels)) {
        if (labels[key] !== value) throw new DockerWorkloadOwnershipError()
      }
    }
  }

  async create(connection: DockerConnection, input: CreateDockerWorkloadInput): Promise<DockerWorkloadReceipt> {
    this.assertEnabled()
    assertScope(input)
    const image = assertImageReference(input.image)
    const name = containerName(input)
    const resources = normalizeResources(input.resources)
    const environment = normalizeEnvironment(input.publicEnvironment)
    const exposedPorts = normalizePorts(input.exposedPorts)
    const volumes = normalizeVolumes(input, input.volumes)

    for (const volume of volumes) await this.ensureVolume(connection, volume)

    const labels = labelsFor(input)
    const mounts = volumes.map((volume) => ({
      Type: 'volume',
      Source: volume.name,
      Target: volume.target,
      ReadOnly: volume.readOnly,
    }))
    const body = {
      Image: image,
      Env: environment,
      ExposedPorts: exposedPorts,
      Labels: labels,
      HostConfig: {
        NetworkMode: 'bridge',
        Privileged: false,
        ReadonlyRootfs: true,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        PidsLimit: 256,
        Memory: resources.memoryBytes,
        NanoCpus: resources.nanoCpus,
        OomKillDisable: false,
        RestartPolicy: { Name: 'unless-stopped' },
        Mounts: mounts,
      },
    }
    const response = await this.transport.request(connection, {
      method: 'POST',
      path: `/containers/create?name=${encodeURIComponent(name)}`,
      body,
      timeoutMs: 20_000,
    })
    const result = responseRecord(response, [201], 'create managed container')
    const containerId = typeof result.Id === 'string' ? result.Id : ''
    if (!CONTAINER_ID.test(containerId)) {
      throw new DockerWorkloadTransportError(
        'Docker Engine returned an invalid container identifier after create',
        { outcomeUnknown: true, statusCode: response.statusCode },
      )
    }
    return {
      containerId,
      containerName: name,
      image,
      labels,
      volumeNames: volumes.map((volume) => volume.name),
    }
  }

  async inspect(
    connection: DockerConnection,
    scope: DockerWorkloadScope,
    containerId: string,
  ): Promise<DockerWorkloadInspection | null> {
    this.assertEnabled()
    assertScope(scope)
    if (!CONTAINER_ID.test(containerId)) throw new TypeError('Invalid Docker container identifier')
    const response = await this.transport.request(connection, {
      method: 'GET',
      path: `/containers/${containerId}/json`,
    })
    if (response.statusCode === 404) return null
    const result = responseRecord(response, [200], 'inspect managed container')
    const config = asRecord(result.Config, 'container config')
    const rawLabels = config.Labels
    const labels = rawLabels && typeof rawLabels === 'object' && !Array.isArray(rawLabels)
      ? rawLabels as Record<string, string>
      : {}
    this.assertOwned(labels, scope)
    const state = asRecord(result.State, 'container state')
    const rawMounts = Array.isArray(result.Mounts) ? result.Mounts : []
    const volumeNames = rawMounts.flatMap((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
      const mount = raw as Record<string, unknown>
      return mount.Type === 'volume' && typeof mount.Name === 'string' ? [mount.Name] : []
    })
    return {
      containerId: typeof result.Id === 'string' ? result.Id : containerId,
      image: typeof config.Image === 'string' ? config.Image : '',
      state: typeof state.Status === 'string' ? state.Status : 'unknown',
      running: state.Running === true,
      labels,
      volumeNames,
    }
  }

  private assertOwned(labels: Record<string, string>, scope: DockerWorkloadScope): void {
    const expected = labelsFor(scope)
    if (labels[MANAGED_LABEL] !== MANAGED_BY ||
        labels[OWNER_LABEL] !== expected[OWNER_LABEL] ||
        labels[DEPLOYMENT_LABEL] !== scope.deploymentId) {
      throw new DockerWorkloadOwnershipError()
    }
  }

  async start(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<void> {
    this.assertEnabled()
    const inspected = await this.inspect(connection, scope, containerId)
    if (!inspected) throw new Error('Managed deployment container was not found')
    if (inspected.running) return
    const response = await this.transport.request(connection, {
      method: 'POST',
      path: `/containers/${containerId}/start`,
    })
    responseRecord(response, [204, 304], 'start managed container')
  }

  async stop(
    connection: DockerConnection,
    scope: DockerWorkloadScope,
    containerId: string,
    graceSeconds = 10,
  ): Promise<void> {
    this.assertEnabled()
    if (!Number.isInteger(graceSeconds) || graceSeconds < 1 || graceSeconds > 30) {
      throw new TypeError('Container stop grace period must be between 1 and 30 seconds')
    }
    const inspected = await this.inspect(connection, scope, containerId)
    if (!inspected) return
    if (!inspected.running) return
    const response = await this.transport.request(connection, {
      method: 'POST',
      path: `/containers/${containerId}/stop?t=${graceSeconds}`,
      timeoutMs: (graceSeconds + 10) * 1000,
    })
    responseRecord(response, [204, 304], 'stop managed container')
  }

  async remove(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<boolean> {
    this.assertEnabled()
    const inspected = await this.inspect(connection, scope, containerId)
    if (!inspected) return false
    if (inspected.running) throw new Error('Stop a managed container before removing it')
    const response = await this.transport.request(connection, {
      method: 'DELETE',
      path: `/containers/${containerId}?v=0&force=0`,
    })
    responseRecord(response, [204, 404], 'remove managed container')
    // v=0 is explicit: named persistent volumes are never removed here.
    return response.statusCode === 204
  }
}
