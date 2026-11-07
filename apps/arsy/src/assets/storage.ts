import { createHash, createHmac } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ownerHashPattern = /^[a-f0-9]{64}$/

export interface AssetStorageAdapter {
  write(ownerId: string, assetId: string, content: Buffer): Promise<{ storageKey: string; checksumSha256: string }>
  read(storageKey: string): Promise<Buffer>
  delete(storageKey: string): Promise<void>
}

function parseStorageKey(storageKey: string): { ownerHash: string; assetId: string } {
  const [ownerHash, assetId, extra] = storageKey.split('/')
  if (!ownerHashPattern.test(ownerHash ?? '') || !assetIdPattern.test(assetId ?? '') || extra) throw new Error('INVALID_ASSET_STORAGE_KEY')
  return { ownerHash, assetId }
}
function checksum(content: Buffer): string { return createHash('sha256').update(content).digest('hex') }

export class LocalAssetStorage implements AssetStorageAdapter {
  constructor(private readonly rootDirectory: string | undefined) {}
  private root(): string {
    if (!this.rootDirectory?.trim()) throw new Error('ARSY_ASSET_STORAGE_DIR_NOT_CONFIGURED')
    return path.resolve(this.rootDirectory)
  }
  private resolveKey(storageKey: string): string {
    const { ownerHash, assetId } = parseStorageKey(storageKey)
    const root = this.root()
    const target = path.resolve(root, ownerHash, assetId)
    const relative = path.relative(root, target)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('INVALID_ASSET_STORAGE_KEY')
    return target
  }
  async write(ownerId: string, assetId: string, content: Buffer): Promise<{ storageKey: string; checksumSha256: string }> {
    if (!assetIdPattern.test(assetId)) throw new Error('INVALID_ASSET_ID')
    const ownerHash = createHash('sha256').update(ownerId).digest('hex')
    const storageKey = `${ownerHash}/${assetId}`
    const target = this.resolveKey(storageKey)
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    await writeFile(target, content, { flag: 'wx', mode: 0o600 })
    return { storageKey, checksumSha256: checksum(content) }
  }
  async read(storageKey: string): Promise<Buffer> { return readFile(this.resolveKey(storageKey)) }
  async delete(storageKey: string): Promise<void> {
    await unlink(this.resolveKey(storageKey)).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
      throw error
    })
  }
}

type S3Config = { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string; sessionToken?: string }
function hmac(key: Buffer | string, value: string): Buffer { return createHmac('sha256', key).update(value).digest() }

/** Path-style S3-compatible storage authenticated with AWS Signature Version 4. */
export class S3CompatibleAssetStorage implements AssetStorageAdapter {
  constructor(private readonly config: S3Config) {}
  private async request(method: 'PUT' | 'GET' | 'DELETE', storageKey: string, content?: Buffer): Promise<Response> {
    const { ownerHash, assetId } = parseStorageKey(storageKey)
    const endpoint = new URL(this.config.endpoint)
    const url = new URL(endpoint.toString())
    url.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/${encodeURIComponent(this.config.bucket)}/${ownerHash}/${assetId}`
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const payloadHash = checksum(content ?? Buffer.alloc(0))
    const canonicalHeaders = [
      `host:${url.host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      ...(this.config.sessionToken ? [`x-amz-security-token:${this.config.sessionToken}`] : []),
      '',
    ].join('\n')
    const signedHeaders = ['host', 'x-amz-content-sha256', 'x-amz-date', ...(this.config.sessionToken ? ['x-amz-security-token'] : [])].join(';')
    const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
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
        ...(this.config.sessionToken ? { 'x-amz-security-token': this.config.sessionToken } : {}),
      },
      ...(method === 'PUT' ? { body: content } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
  }
  async write(ownerId: string, assetId: string, content: Buffer): Promise<{ storageKey: string; checksumSha256: string }> {
    if (!assetIdPattern.test(assetId)) throw new Error('INVALID_ASSET_ID')
    const storageKey = `${createHash('sha256').update(ownerId).digest('hex')}/${assetId}`
    const response = await this.request('PUT', storageKey, content)
    if (!response.ok) throw new Error(`S3_ASSET_PUT_FAILED_${response.status}`)
    return { storageKey, checksumSha256: checksum(content) }
  }
  async read(storageKey: string): Promise<Buffer> {
    const response = await this.request('GET', storageKey)
    if (response.status === 404) throw Object.assign(new Error('ASSET_OBJECT_NOT_FOUND'), { code: 'ENOENT' })
    if (!response.ok) throw new Error(`S3_ASSET_GET_FAILED_${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  async delete(storageKey: string): Promise<void> {
    const response = await this.request('DELETE', storageKey)
    if (!response.ok && response.status !== 404) throw new Error(`S3_ASSET_DELETE_FAILED_${response.status}`)
  }
}

export function createAssetStorage(env: NodeJS.ProcessEnv = process.env): AssetStorageAdapter {
  const driver = env.ARSY_ASSET_STORAGE_DRIVER?.trim() || (env.NODE_ENV === 'production' ? 's3' : 'local')
  if (driver === 'local') {
    if (env.NODE_ENV === 'production') throw new Error('LOCAL_ASSET_STORAGE_FORBIDDEN_IN_PRODUCTION')
    return new LocalAssetStorage(env.ARSY_ASSET_STORAGE_DIR)
  }
  if (driver !== 's3') throw new Error('UNSUPPORTED_ASSET_STORAGE_DRIVER')
  const endpoint = env.ARSY_ASSET_STORAGE_ENDPOINT?.trim()
  const bucket = env.ARSY_ASSET_STORAGE_BUCKET?.trim()
  const accessKeyId = env.ARSY_ASSET_STORAGE_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.ARSY_ASSET_STORAGE_SECRET_ACCESS_KEY?.trim()
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('S3_ASSET_STORAGE_NOT_CONFIGURED')
  const parsedEndpoint = new URL(endpoint)
  if (parsedEndpoint.username || parsedEndpoint.password) throw new Error('S3_ASSET_STORAGE_ENDPOINT_MUST_NOT_EMBED_CREDENTIALS')
  if (parsedEndpoint.search || parsedEndpoint.hash) throw new Error('S3_ASSET_STORAGE_ENDPOINT_MUST_NOT_HAVE_QUERY_OR_HASH')
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('S3_ASSET_STORAGE_BUCKET_INVALID')
  if (env.NODE_ENV === 'production' && parsedEndpoint.protocol !== 'https:') throw new Error('S3_ASSET_STORAGE_REQUIRES_HTTPS')
  return new S3CompatibleAssetStorage({
    endpoint, bucket, region: env.ARSY_ASSET_STORAGE_REGION?.trim() || 'us-east-1',
    accessKeyId, secretAccessKey, sessionToken: env.ARSY_ASSET_STORAGE_SESSION_TOKEN?.trim() || undefined,
  })
}
