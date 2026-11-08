import { createHash } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import type { IncomingMessage } from 'node:http'
import { isIP } from 'node:net'
import {
  resolveRemoteDockerEndpoint,
  validateTlsCredentials,
} from '../docker/security.ts'
import type { DockerConnection } from '../docker/engine.ts'
import type {
  CreateDockerWorkloadInput,
  DockerWorkloadInspection,
  DockerWorkloadPort,
  DockerWorkloadRequest,
  DockerWorkloadResponse,
  DockerWorkloadScope,
  DockerWorkloadTransport,
  DockerWorkloadReceipt,
} from './docker-workload-port.ts'

const MANAGED_BY = 'arsy-deployment-adapter'
const MIN_MEMORY_BYTES = 128 * 1024 * 1024
const MAX_MEMORY_BYTES = 8 * 1024 * 1024 * 1024
const MIN_NANO_CPUS = 100_000_000
const MAX_NANO_CPUS = 8_000_000_000
const MAX_REQUEST_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 5_000
const CONTAINER_ID = /^[a-f0-9]{12,64}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class DockerWorkloadDisabledError extends Error {
  constructor() {
    super('Docker workload mutations are disabled')
    this.name = 'DockerWorkloadDisabledError'
  }
}

export class DockerWorkloadOwnershipError extends Error {
  constructor() {
    super('Docker resource is not owned by the requested deployment scope')
    this.name = 'DockerWorkloadOwnershipError'
  }
}

export class DockerWorkloadTransportError extends Error {
  readonly outcomeUnknown: boolean
  readonly statusCode: number | null

  constructor(message: string, options: { outcomeUnknown?: boolean; statusCode?: number | null } = {}) {
    super(message)
    this.name = 'DockerWorkloadTransportError'
    this.outcomeUnknown = options.outcomeUnknown ?? false
    this.statusCode = options.statusCode ?? null
  }
}

function ownerHash(ownerId: string): string {
  return createHash('sha256').update(ownerId).digest('hex').slice(0, 16)
}

function requiredText(value: string, field: string, max: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new TypeError(`${field} must contain 1-${max} characters`)
  return normalized
}

function validateScope(scope: DockerWorkloadScope): DockerWorkloadScope {
  const ownerId = requiredText(scope.ownerId, 'ownerId', 128)
  const deploymentId = requiredText(scope.deploymentId, 'deploymentId', 64)
  const operationId = requiredText(scope.operationId, 'operationId', 64)
  if (!UUID.test(deploymentId) || !UUID.test(operationId)) throw new TypeError('Deployment and operation IDs must be UUIDs')
  return { ownerId, deploymentId, operationId }
}

function labelsFor(scope: DockerWorkloadScope): Record<string, string> {
  return {
    'io.moonwitness.managed-by': MANAGED_BY,
    'io.moonwitness.owner-hash': ownerHash(scope.ownerId),
    'io.moonwitness.deployment-id': scope.deploymentId,
    'io.moonwitness.operation-id': scope.operationId,
  }
}

function volumeName(scope: DockerWorkloadScope, key: string): string {
  const identity = createHash('sha256')
    .update(`${scope.ownerId}:${scope.deploymentId}:${key}`)
    .digest('hex')
    .slice(0, 24)
  return `mw-${ownerHash(scope.ownerId)}-${identity}`
}

function validateImage(image: string): string {
  const normalized = requiredText(image, 'image', 512)
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:@-]*@sha256:[a-f0-9]{64}$/.test(normalized)) {
    throw new TypeError('Docker workload image must use an immutable sha256 digest')
  }
  return normalized
}

function validateResources(resources: CreateDockerWorkloadInput['resources']): void {
  if (!Number.isSafeInteger(resources?.memoryBytes) ||
      resources.memoryBytes < MIN_MEMORY_BYTES || resources.memoryBytes > MAX_MEMORY_BYTES) {
    throw new TypeError('memoryBytes must be between 128 MiB and 8 GiB')
  }
  if (!Number.isSafeInteger(resources?.nanoCpus) ||
      resources.nanoCpus < MIN_NANO_CPUS || resources.nanoCpus > MAX_NANO_CPUS) {
    throw new TypeError('nanoCpus must be between 0.1 and 8 CPUs')
  }
}

function validateEnvironment(environment: Record<string, string> | undefined): Array<[string, string]> {
  if (environment === undefined) return []
  if (!environment || typeof environment !== 'object' || Array.isArray(environment) ||
      (Object.getPrototypeOf(environment) !== Object.prototype && Object.getPrototypeOf(environment) !== null) ||
      Object.keys(environment).length > 64) {
    throw new TypeError('publicEnvironment must be an object with at most 64 entries')
  }
  const entries: Array<[string, string]> = []
  for (const [key, value] of Object.entries(environment)) {
    if (!/^PUBLIC_[A-Z0-9_]{1,60}$/.test(key) ||
        /(PASSWORD|TOKEN|SECRET|PRIVATE|CREDENTIAL|API_KEY)/i.test(key)) {
      throw new TypeError('Only non-secret PUBLIC_* environment values are accepted')
    }
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000\r\n]/.test(value)) {
      throw new TypeError('Public environment values must be bounded single-line strings')
    }
    entries.push([key, value])
  }
  return entries.sort(([left], [right]) => left.localeCompare(right))
}

function validateVolumes(scope: DockerWorkloadScope, volumes: CreateDockerWorkloadInput['volumes'] = []) {
  if (!Array.isArray(volumes) || volumes.length > 16) throw new TypeError('At most 16 persistent volumes are allowed')
  const keys = new Set<string>()
  const targets = new Set<string>()
  return volumes.map((volume) => {
    if (!isRecord(volume)) throw new TypeError('Volume declarations must be objects')
    const key = requiredText(volume.key, 'volume key', 41)
    const target = requiredText(volume.target, 'volume target', 180)
    if (!/^[a-z0-9][a-z0-9_.-]{0,40}$/.test(key) || keys.has(key) ||
        (volume.readOnly !== undefined && typeof volume.readOnly !== 'boolean')) {
      throw new TypeError('Volume keys must be unique bounded identifiers')
    }
    if (!/^\/data(?:\/[A-Za-z0-9._-]+)+$/.test(target) ||
        target.split('/').some((segment) => segment === '.' || segment === '..') ||
        targets.has(target)) {
      throw new TypeError('Volume targets must be unique paths below /data')
    }
    keys.add(key)
    targets.add(target)
    return { key, target, readOnly: volume.readOnly === true, name: volumeName(scope, key) }
  })
}

function validateExposedPorts(ports: number[] = []): Record<string, Record<string, never>> {
  if (!Array.isArray(ports) || ports.length > 32) throw new TypeError('At most 32 container ports may be declared')
  const result: Record<string, Record<string, never>> = {}
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('Exposed ports must be between 1 and 65535')
    result[`${port}/tcp`] = {}
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DockerWorkloadTransportError('Docker Engine returned an invalid object response')
  }
  return value
}

function expectStatus(
  response: DockerWorkloadResponse,
  expected: number[],
  action: string,
  mutation = false,
): Record<string, unknown> {
  if (!expected.includes(response.statusCode)) {
    throw new DockerWorkloadTransportError(
      `Docker Engine ${action} returned HTTP ${response.statusCode}`,
      { statusCode: response.statusCode, outcomeUnknown: mutation && response.statusCode >= 500 },
    )
  }
  if (response.body === null || response.body === undefined) return {}
  return bodyObject(response.body)
}

function isAllowedEngineRequest(request: DockerWorkloadRequest): boolean {
  const id = '[a-f0-9]{12,64}'
  if (request.method === 'GET') {
    return new RegExp(`^/volumes/[a-z0-9][a-z0-9_.-]{0,63}$`).test(request.path) ||
      new RegExp(`^/containers/${id}/json$`, 'i').test(request.path)
  }
  if (request.method === 'POST') {
    return request.path === '/volumes/create' ||
      /^\/containers\/create\?name=[a-z0-9][a-z0-9_.-]{0,62}$/i.test(request.path) ||
      new RegExp(`^/containers/${id}/start$`, 'i').test(request.path) ||
      new RegExp(`^/containers/${id}/stop\\?t=(?:0|[1-9][0-9]?|1[01][0-9]|120)$`, 'i').test(request.path)
  }
  if (request.method === 'DELETE') {
    return new RegExp(`^/containers/${id}\\?v=0&force=0$`, 'i').test(request.path)
  }
  return false
}

function decodeResponse(buffer: Buffer): unknown {
  if (buffer.length === 0) return null
  const text = buffer.toString('utf8')
  try { return JSON.parse(text) as unknown } catch { return text.slice(0, 4096) }
}

export class NodeDockerWorkloadTransport implements DockerWorkloadTransport {
  private readonly env: NodeJS.ProcessEnv
  private readonly timeoutMs: number

  constructor(options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}) {
    this.env = options.env ?? process.env
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 30_000) {
      throw new TypeError('Docker workload timeout must be between 100 and 30000 ms')
    }
  }

  async request(connection: DockerConnection, request: DockerWorkloadRequest): Promise<DockerWorkloadResponse> {
    if (!isAllowedEngineRequest(request)) {
      throw new DockerWorkloadTransportError('unsupported Engine API path')
    }
    const body = request.body === undefined ? null : Buffer.from(JSON.stringify(request.body), 'utf8')
    if (body && body.length > MAX_REQUEST_BYTES) {
      throw new DockerWorkloadTransportError('Docker workload request exceeded 64 KiB')
    }

    let options: http.RequestOptions | https.RequestOptions
    if (connection.kind === 'local') {
      if (connection.socketPath !== '/var/run/docker.sock' && connection.socketPath !== '/run/docker.sock') {
        throw new DockerWorkloadTransportError('Local Docker socket path is not an approved host socket')
      }
      options = { socketPath: connection.socketPath, path: request.path, method: request.method }
    } else {
      let endpoint: URL
      try {
        endpoint = new URL(connection.endpointUrl)
      } catch {
        throw new DockerWorkloadTransportError('Remote Docker endpoint is invalid')
      }
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
          endpoint.search || endpoint.hash || (endpoint.pathname !== '/' && endpoint.pathname !== '') ||
          (endpoint.port && endpoint.port !== '2376')) {
        throw new DockerWorkloadTransportError('Remote Docker endpoint must use the validated HTTPS endpoint')
      }
      const tls = validateTlsCredentials(connection.tls)
      const pinned = connection.addresses
      if (!Array.isArray(pinned) || pinned.length === 0 || pinned.length > 16 ||
          pinned.some((item) => !item || isIP(item.address) !== item.family)) {
        throw new DockerWorkloadTransportError('Remote Docker endpoint requires validated pinned DNS addresses')
      }
      const current = await resolveRemoteDockerEndpoint(endpoint.origin, this.env)
      const currentAddresses = new Set(current.addresses.map((item) => `${item.family}:${item.address}`))
      if (pinned.some((item) => !currentAddresses.has(`${item.family}:${item.address}`))) {
        throw new DockerWorkloadTransportError('Remote Docker DNS pin is stale; reconnect and revalidate the endpoint')
      }
      const lookup = ((_hostname: string, lookupOptions: number | { family?: number; all?: boolean }, callback: (...args: unknown[]) => void) => {
        const family = typeof lookupOptions === 'number' ? lookupOptions : lookupOptions.family ?? 0
        const candidates = pinned.filter((item) => !family || item.family === family)
        if (candidates.length === 0) return callback(new Error('No validated Docker endpoint address'))
        if (typeof lookupOptions === 'object' && lookupOptions.all) {
          callback(null, candidates.map(({ address, family: addressFamily }) => ({ address, family: addressFamily })))
        } else {
          callback(null, candidates[0].address, candidates[0].family)
        }
      }) as NonNullable<https.RequestOptions['lookup']>
      options = {
        hostname: endpoint.hostname,
        port: endpoint.port || 2376,
        path: request.path,
        method: request.method,
        ca: tls.ca,
        cert: tls.cert,
        key: tls.key,
        rejectUnauthorized: true,
        servername: endpoint.hostname,
        lookup,
      }
    }

    return new Promise((resolve, reject) => {
      let received = 0
      const chunks: Buffer[] = []
      const onResponse = (response: IncomingMessage) => {
        response.on('data', (chunk: Buffer | string) => {
          const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          received += part.length
          if (received > MAX_RESPONSE_BYTES) {
            response.destroy(new Error('Docker Engine response exceeded 1 MiB'))
            return
          }
          chunks.push(part)
        })
        response.on('end', () => resolve({
          statusCode: response.statusCode ?? 0,
          body: decodeResponse(Buffer.concat(chunks)),
        }))
        response.on('error', (error) => reject(new DockerWorkloadTransportError(
          error.message,
          { outcomeUnknown: request.method !== 'GET' },
        )))
      }
      const outgoing = connection.kind === 'remote'
        ? https.request(options as https.RequestOptions, onResponse)
        : http.request(options as http.RequestOptions, onResponse)
      outgoing.setTimeout(this.timeoutMs, () => outgoing.destroy(new Error('Docker Engine request timed out')))
      outgoing.on('error', (error) => reject(new DockerWorkloadTransportError(
        error.message,
        { outcomeUnknown: request.method !== 'GET' },
      )))
      if (body) outgoing.setHeader('content-type', 'application/json')
      outgoing.end(body ?? undefined)
    })
  }
}

export class DockerWorkloadAdapter implements DockerWorkloadPort {
  private readonly enabled: boolean
  private readonly transport: DockerWorkloadTransport

  constructor(options: { enabled?: boolean; transport?: DockerWorkloadTransport } = {}) {
    this.enabled = options.enabled === true
    this.transport = options.transport ?? new NodeDockerWorkloadTransport()
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new DockerWorkloadDisabledError()
  }

  private async call(
    connection: DockerConnection,
    request: DockerWorkloadRequest,
    expected: number[],
    action: string,
    mutation = false,
  ): Promise<Record<string, any>> {
    let response: DockerWorkloadResponse
    try {
      response = await this.transport.request(connection, request)
    } catch (error) {
      if (error instanceof DockerWorkloadTransportError) throw error
      throw new DockerWorkloadTransportError(
        error instanceof Error ? error.message : 'Docker Engine transport failed',
        { outcomeUnknown: mutation },
      )
    }
    return expectStatus(response, expected, action, mutation)
  }

  private async ensureVolume(
    connection: DockerConnection,
    scope: DockerWorkloadScope,
    volume: { key: string; target: string; readOnly: boolean; name: string },
  ): Promise<string> {
    const labels = labelsFor(scope)
    let existing: DockerWorkloadResponse
    try {
      existing = await this.transport.request(connection, { method: 'GET', path: `/volumes/${volume.name}` })
    } catch (error) {
      if (error instanceof DockerWorkloadTransportError) throw error
      throw new DockerWorkloadTransportError(
        error instanceof Error ? error.message : 'Docker volume inspection failed',
      )
    }
    if (existing.statusCode === 200) {
      const data = bodyObject(existing.body)
      const existingLabels = isRecord(data.Labels) ? data.Labels : null
      if (!existingLabels || existingLabels['io.moonwitness.managed-by'] !== MANAGED_BY ||
          existingLabels['io.moonwitness.owner-hash'] !== labels['io.moonwitness.owner-hash'] ||
          existingLabels['io.moonwitness.deployment-id'] !== scope.deploymentId) {
        throw new DockerWorkloadOwnershipError()
      }
      return volume.name
    }
    if (existing.statusCode !== 404) {
      throw new DockerWorkloadTransportError(
        `Docker Engine volume inspection returned HTTP ${existing.statusCode}`,
        { statusCode: existing.statusCode },
      )
    }
    const created = await this.call(connection, {
      method: 'POST',
      path: '/volumes/create',
      body: {
        Name: volume.name,
        Driver: 'local',
        Labels: labels,
      },
    }, [201], 'volume creation', true)
    const createdLabels = isRecord(created.Labels) ? created.Labels : null
    if (created.Name !== volume.name || !createdLabels ||
        createdLabels['io.moonwitness.managed-by'] !== MANAGED_BY ||
        createdLabels['io.moonwitness.owner-hash'] !== labels['io.moonwitness.owner-hash'] ||
        createdLabels['io.moonwitness.deployment-id'] !== scope.deploymentId) {
      throw new DockerWorkloadTransportError('Docker Engine did not confirm the owner-bound persistent volume', { outcomeUnknown: true })
    }
    return volume.name
  }

  private async inspectManaged(
    connection: DockerConnection,
    scope: DockerWorkloadScope,
    containerId: string,
  ): Promise<DockerWorkloadInspection> {
    if (!CONTAINER_ID.test(containerId)) throw new TypeError('Invalid Docker container identifier')
    const data = await this.call(
      connection,
      { method: 'GET', path: `/containers/${containerId}/json` },
      [200],
      'container inspection',
    )
    if (data.Id !== containerId) throw new DockerWorkloadOwnershipError()
    const config = isRecord(data.Config) ? data.Config : {}
    const labels = isRecord(config.Labels) ? config.Labels : null
    const expected = labelsFor(scope)
    if (!labels || labels['io.moonwitness.managed-by'] !== MANAGED_BY ||
        labels['io.moonwitness.owner-hash'] !== expected['io.moonwitness.owner-hash'] ||
        labels['io.moonwitness.deployment-id'] !== scope.deploymentId ||
        labels['io.moonwitness.operation-id'] !== scope.operationId) {
      throw new DockerWorkloadOwnershipError()
    }
    const mounts = Array.isArray(data.Mounts) ? data.Mounts.filter(isRecord).slice(0, 32).map((mount) => ({
      type: typeof mount.Type === 'string' ? mount.Type : 'unknown',
      name: typeof mount.Name === 'string' ? mount.Name : null,
      target: typeof mount.Destination === 'string' ? mount.Destination : '',
      readOnly: mount.RW === false,
    })) : []
    const safeLabels = Object.fromEntries(
      Object.entries(labels).filter((entry): entry is [string, string] => typeof entry[1] === 'string').slice(0, 32),
    )
    return {
      containerId,
      image: typeof config.Image === 'string' ? config.Image : '',
      running: isRecord(data.State) && data.State.Running === true,
      state: isRecord(data.State) && typeof data.State.Status === 'string' ? data.State.Status : 'unknown',
      labels: safeLabels,
      mounts,
    }
  }

  async create(connection: DockerConnection, input: CreateDockerWorkloadInput): Promise<DockerWorkloadReceipt> {
    this.assertEnabled()
    const scope = validateScope(input)
    const name = requiredText(input.name, 'name', 63)
    if (!/^[a-z0-9][a-z0-9_.-]{0,62}$/.test(name)) throw new TypeError('Container name must be a lowercase DNS-like identifier')
    const image = validateImage(input.image)
    validateResources(input.resources)
    const environment = validateEnvironment(input.publicEnvironment)
    const volumes = validateVolumes(scope, input.volumes)
    const exposedPorts = validateExposedPorts(input.exposedPorts)
    const labels = labelsFor(scope)

    const volumeNames: string[] = []
    for (const volume of volumes) {
      volumeNames.push(await this.ensureVolume(connection, scope, volume))
    }

    const mounts = volumes.map((volume) => ({
      Type: 'volume',
      Source: volume.name,
      Target: volume.target,
      ReadOnly: volume.readOnly,
    }))
    const data = await this.call(connection, {
      method: 'POST',
      path: `/containers/create?name=${name}`,
      body: {
        Image: image,
        Env: environment.map(([key, value]) => `${key}=${value}`),
        Labels: labels,
        ExposedPorts: exposedPorts,
        HostConfig: {
          NetworkMode: 'bridge',
          Privileged: false,
          ReadonlyRootfs: true,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true'],
          Memory: input.resources.memoryBytes,
          NanoCpus: input.resources.nanoCpus,
          Mounts: mounts,
        },
      },
    }, [201], 'container creation', true)
    const containerId = typeof data.Id === 'string' ? data.Id : ''
    if (!CONTAINER_ID.test(containerId)) {
      throw new DockerWorkloadTransportError('Docker Engine did not return a valid container identifier', { outcomeUnknown: true })
    }
    const warnings = Array.isArray(data.Warnings)
      ? data.Warnings.filter((item: unknown): item is string => typeof item === 'string').slice(0, 20).map((item: string) => item.slice(0, 256))
      : []
    return { containerId, image, volumeNames, warnings }
  }

  async inspect(
    connection: DockerConnection,
    scopeInput: DockerWorkloadScope,
    containerId: string,
  ): Promise<DockerWorkloadInspection> {
    this.assertEnabled()
    return this.inspectManaged(connection, validateScope(scopeInput), containerId)
  }

  async start(connection: DockerConnection, scopeInput: DockerWorkloadScope, containerId: string): Promise<void> {
    this.assertEnabled()
    const scope = validateScope(scopeInput)
    const current = await this.inspectManaged(connection, scope, containerId)
    if (current.running) return
    await this.call(
      connection,
      { method: 'POST', path: `/containers/${containerId}/start` },
      [204, 304],
      'container start',
      true,
    )
  }

  async stop(
    connection: DockerConnection,
    scopeInput: DockerWorkloadScope,
    containerId: string,
    timeoutSeconds = 10,
  ): Promise<void> {
    this.assertEnabled()
    const scope = validateScope(scopeInput)
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > 120) {
      throw new TypeError('Container stop timeout must be between 0 and 120 seconds')
    }
    const current = await this.inspectManaged(connection, scope, containerId)
    if (!current.running) return
    await this.call(
      connection,
      { method: 'POST', path: `/containers/${containerId}/stop?t=${timeoutSeconds}` },
      [204, 304],
      'container stop',
      true,
    )
  }

  async remove(connection: DockerConnection, scopeInput: DockerWorkloadScope, containerId: string): Promise<boolean> {
    this.assertEnabled()
    const scope = validateScope(scopeInput)
    const current = await this.inspectManaged(connection, scope, containerId)
    if (current.running || current.state === 'running') {
      throw new Error('Stop a managed container before removing it')
    }
    let response: DockerWorkloadResponse
    try {
      response = await this.transport.request(connection, {
        method: 'DELETE',
        path: `/containers/${containerId}?v=0&force=0`,
      })
    } catch (error) {
      if (error instanceof DockerWorkloadTransportError) throw error
      throw new DockerWorkloadTransportError(
        error instanceof Error ? error.message : 'Docker container removal failed',
        { outcomeUnknown: true },
      )
    }
    if (response.statusCode === 404) return true
    expectStatus(response, [204], 'container removal', true)
    return true
  }
}
