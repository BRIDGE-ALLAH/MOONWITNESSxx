import http from 'node:http'
import https from 'node:https'
import type { IncomingMessage } from 'node:http'
import type { DockerTlsCredentials, ResolvedDockerAddress } from './security.ts'

export type DockerConnection =
  | { kind: 'local'; socketPath: string }
  | { kind: 'remote'; endpointUrl: string; addresses: ResolvedDockerAddress[]; tls: DockerTlsCredentials }

export interface DockerContainer {
  id: string
  names: string[]
  image: string
  state: string
  status: string
  createdAt: number
}

export interface DockerContainerLogs {
  stdout: string
  stderr: string
}

function requestBuffer(connection: DockerConnection, path: string, timeoutMs = 5000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const remoteUrl = connection.kind === 'remote' ? new URL(connection.endpointUrl) : null
    const pinnedLookup = connection.kind === 'remote'
      ? ((_hostname, options, callback) => {
          const lookupOptions = typeof options === 'object' && options ? options : {}
          const requestedFamily = lookupOptions.family ?? 0
          const candidates = connection.addresses.filter(
            (item) => !requestedFamily || item.family === requestedFamily,
          )
          if (candidates.length === 0) {
            const error = new Error('Docker endpoint has no validated address')
            return lookupOptions.all
              ? callback(error, [])
              : callback(error, '', 0)
          }

          // Node's lookup callback has two contracts. In all-address mode the
          // callback must receive LookupAddress[]; otherwise it receives one
          // address and its family. Keep candidates DNS-pinned to addresses
          // that passed the endpoint policy check.
          if (lookupOptions.all) {
            callback(null, candidates.map(({ address, family }) => ({ address, family })))
          } else {
            const selected = candidates[0]
            callback(null, selected.address, selected.family)
          }
        }) as NonNullable<https.RequestOptions['lookup']>
      : undefined
    const options: https.RequestOptions & http.RequestOptions = connection.kind === 'local'
      ? { socketPath: connection.socketPath, path, method: 'GET' }
      : {
          hostname: remoteUrl!.hostname,
          port: remoteUrl!.port || 2376,
          path,
          method: 'GET',
          ca: connection.tls.ca,
          cert: connection.tls.cert,
          key: connection.tls.key,
          rejectUnauthorized: true,
          servername: remoteUrl!.hostname,
          lookup: pinnedLookup,
        }

    const onResponse = (response: IncomingMessage) => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Docker Engine returned HTTP ${response.statusCode ?? 0}`))
        return
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 1_048_576) {
          response.destroy(new Error('Docker Engine response exceeded 1 MiB'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    }

    const request = connection.kind === 'remote'
      ? https.request(options as https.RequestOptions, onResponse)
      : http.request(options as http.RequestOptions, onResponse)
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Docker Engine request timed out')))
    request.on('error', reject)
    request.end()
  })
}

async function requestJson<T>(connection: DockerConnection, path: string, timeoutMs = 5000): Promise<T> {
  const body = await requestBuffer(connection, path, timeoutMs)
  try {
    return JSON.parse(body.toString('utf8')) as T
  } catch {
    throw new Error('Docker Engine returned invalid JSON')
  }
}

function decodeDockerLogs(buffer: Buffer): DockerContainerLogs {
  if (buffer.length === 0) return { stdout: '', stderr: '' }
  const firstFrameLooksMultiplexed = buffer.length >= 8 &&
    (buffer[0] === 1 || buffer[0] === 2) &&
    buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 0
  if (!firstFrameLooksMultiplexed) return { stdout: buffer.toString('utf8'), stderr: '' }

  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  let offset = 0
  while (offset < buffer.length) {
    if (buffer.length - offset < 8) throw new Error('Docker Engine returned a truncated log frame')
    const stream = buffer[offset]
    const length = buffer.readUInt32BE(offset + 4)
    const frameEnd = offset + 8 + length
    if ((stream !== 1 && stream !== 2) || buffer[offset + 1] !== 0 ||
        buffer[offset + 2] !== 0 || buffer[offset + 3] !== 0 || frameEnd > buffer.length) {
      throw new Error('Docker Engine returned an invalid log frame')
    }
    const payload = buffer.subarray(offset + 8, frameEnd)
    ;(stream === 1 ? stdout : stderr).push(payload)
    offset = frameEnd
  }
  return {
    stdout: Buffer.concat(stdout).toString('utf8'),
    stderr: Buffer.concat(stderr).toString('utf8'),
  }
}

export interface DockerEngineInfo {
  ID?: string
  Name?: string
  ServerVersion?: string
  OperatingSystem?: string
  Architecture?: string
  NCPU?: number
  MemTotal?: number
}

export async function getDockerInfo(connection: DockerConnection): Promise<DockerEngineInfo> {
  return requestJson<DockerEngineInfo>(connection, '/info')
}

export async function listDockerContainers(connection: DockerConnection): Promise<DockerContainer[]> {
  const result = await requestJson<Array<Record<string, unknown>>>(connection, '/containers/json?all=1&limit=100')
  if (!Array.isArray(result)) throw new Error('Docker Engine returned an invalid container inventory')
  return result.slice(0, 100).map((item) => ({
    id: typeof item.Id === 'string' ? item.Id : '',
    names: Array.isArray(item.Names) ? item.Names.filter((name): name is string => typeof name === 'string') : [],
    image: typeof item.Image === 'string' ? item.Image : '',
    state: typeof item.State === 'string' ? item.State : 'unknown',
    status: typeof item.Status === 'string' ? item.Status : '',
    createdAt: typeof item.Created === 'number' ? item.Created : 0,
  })).filter((item) => item.id.length > 0)
}

export async function getDockerContainerLogs(connection: DockerConnection, containerId: string): Promise<DockerContainerLogs> {
  if (!/^[a-f0-9]{12,64}$/i.test(containerId)) throw new Error('Invalid Docker container identifier')
  const body = await requestBuffer(
    connection,
    `/containers/${containerId}/logs?stdout=1&stderr=1&tail=200&timestamps=1`,
  )
  return decodeDockerLogs(body)
}
