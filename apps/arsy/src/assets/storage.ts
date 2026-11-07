import { createHash, createHmac } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface AssetStorageAdapter {
  put(key: string, bytes: Buffer, mediaType: string): Promise<void>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}

const KEY_PATTERN = /^[a-f0-9-]{36}$/

export class LocalFileAssetStorage implements AssetStorageAdapter {
  private readonly root: string

  constructor(directory: string) {
    this.root = path.resolve(directory)
  }

  private filePath(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('INVALID_ASSET_STORAGE_KEY')
    const target = path.resolve(this.root, key)
    if (!target.startsWith(this.root + path.sep)) throw new Error('INVALID_ASSET_STORAGE_KEY')
    return target
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await writeFile(this.filePath(key), bytes, { flag: 'wx', mode: 0o600 })
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.filePath(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true })
  }
}

type S3Config = {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

/** S3-compatible path-style object storage using AWS Signature Version 4. */
export class S3CompatibleAssetStorage implements AssetStorageAdapter {
  constructor(private readonly config: S3Config) {}

  private async request(method: 'PUT' | 'GET' | 'DELETE', key: string, bytes?: Buffer, mediaType?: string): Promise<Response> {
    if (!KEY_PATTERN.test(key)) throw new Error('INVALID_ASSET_STORAGE_KEY')
    const endpoint = new URL(this.config.endpoint)
    const url = new URL(endpoint.toString())
    url.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/${encodeURIComponent(this.config.bucket)}/${encodeURIComponent(key)}`

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const payloadHash = sha256(bytes ?? Buffer.alloc(0))
    const canonicalHeaders = [
      `host:${url.host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      ...(this.config.sessionToken ? [`x-amz-security-token:${this.config.sessionToken}`] : []),
      '',
    ].join('\n')
    const signedHeaders = [
      'host', 'x-amz-content-sha256', 'x-amz-date',
      ...(this.config.sessionToken ? ['x-amz-security-token'] : []),
    ].join(';')
    const canonicalRequest = [
      method, url.pathname, url.searchParams.toString(),
      canonicalHeaders, signedHeaders, payloadHash,
    ].join('\n')
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')
    const dateKey = hmac(`AWS4${this.config.secretAccessKey}`, dateStamp)
    const regionKey = hmac(dateKey, this.config.region)
    const serviceKey = hmac(regionKey, 's3')
    const signingKey = hmac(serviceKey, 'aws4_request')
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')
    return fetch(url, {
      method,
      headers: {
        authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        ...(mediaType ? { 'content-type': mediaType } : {}),
        ...(this.config.sessionToken ? { 'x-amz-security-token': this.config.sessionToken } : {}),
      },
      ...(method === 'PUT' ? { body: bytes } : {}),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
  }

  async put(key: string, bytes: Buffer, mediaType: string): Promise<void> {
    const response = await this.request('PUT', key, bytes, mediaType)
    if (!response.ok) throw new Error(`ASSET_STORAGE_PUT_FAILED_${response.status}`)
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.request('GET', key)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`ASSET_STORAGE_GET_FAILED_${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  async delete(key: string): Promise<void> {
    const response = await this.request('DELETE', key)
    if (!response.ok && response.status !== 404) throw new Error(`ASSET_STORAGE_DELETE_FAILED_${response.status}`)
  }
}

export function createAssetStorage(env: NodeJS.ProcessEnv = process.env): AssetStorageAdapter {
  const driver = env.ARSY_ASSET_STORAGE_DRIVER?.trim() || (env.NODE_ENV === 'production' ? 's3' : 'local')
  if (driver === 'local') {
    if (env.NODE_ENV === 'production') throw new Error('LOCAL_ASSET_STORAGE_FORBIDDEN_IN_PRODUCTION')
    return new LocalFileAssetStorage(env.ARSY_ASSET_STORAGE_DIR?.trim() || path.resolve('.data/assets'))
  }
  if (driver !== 's3') throw new Error('UNSUPPORTED_ASSET_STORAGE_DRIVER')
  const endpoint = env.ARSY_ASSET_STORAGE_ENDPOINT?.trim()
  const bucket = env.ARSY_ASSET_STORAGE_BUCKET?.trim()
  const region = env.ARSY_ASSET_STORAGE_REGION?.trim() || 'us-east-1'
  const accessKeyId = env.ARSY_ASSET_STORAGE_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.ARSY_ASSET_STORAGE_SECRET_ACCESS_KEY?.trim()
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('S3_ASSET_STORAGE_NOT_CONFIGURED')
  if (env.NODE_ENV === 'production' && new URL(endpoint).protocol !== 'https:') {
    throw new Error('S3_ASSET_STORAGE_REQUIRES_HTTPS')
  }
  return new S3CompatibleAssetStorage({
    endpoint, bucket, region, accessKeyId, secretAccessKey,
    sessionToken: env.ARSY_ASSET_STORAGE_SESSION_TOKEN?.trim() || undefined,
  })
}
