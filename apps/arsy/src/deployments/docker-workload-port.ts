import type { DockerConnection } from '../docker/engine.ts'

export interface DockerWorkloadScope {
  ownerId: string
  deploymentId: string
  operationId: string
}

export interface DockerWorkloadResources {
  memoryBytes: number
  nanoCpus: number
}

export interface DockerWorkloadVolume {
  key: string
  target: string
  readOnly?: boolean
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
  image: string
  volumeNames: string[]
  warnings: string[]
}

export interface DockerWorkloadInspection {
  containerId: string
  image: string
  running: boolean
  state: string
  labels: Record<string, string>
  mounts: Array<{ type: string; name: string | null; target: string; readOnly: boolean }>
}

export interface DockerWorkloadRequest {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  body?: Record<string, unknown>
}

export interface DockerWorkloadResponse {
  statusCode: number
  body: unknown
}

export interface DockerWorkloadTransport {
  request(connection: DockerConnection, request: DockerWorkloadRequest): Promise<DockerWorkloadResponse>
}

export interface DockerWorkloadPort {
  create(connection: DockerConnection, input: CreateDockerWorkloadInput): Promise<DockerWorkloadReceipt>
  inspect(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<DockerWorkloadInspection>
  start(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<void>
  stop(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string, timeoutSeconds?: number): Promise<void>
  remove(connection: DockerConnection, scope: DockerWorkloadScope, containerId: string): Promise<boolean>
}
