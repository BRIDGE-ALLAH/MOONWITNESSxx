import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'

export interface DockerTlsCredentials { ca: string; cert: string; key: string }

function encryptionKey(env: NodeJS.ProcessEnv): Buffer {
  const encoded = env.DOCKER_CREDENTIALS_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error('DOCKER_CREDENTIALS_ENCRYPTION_KEY is not configured')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('DOCKER_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encryptDockerCredentials(value: DockerTlsCredentials, env = process.env): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decryptDockerCredentials(value: string, env = process.env): DockerTlsCredentials {
  const [ivText, tagText, ciphertextText, extra] = value.split('.')
  if (!ivText || !tagText || !ciphertextText || extra !== undefined) throw new Error('Invalid encrypted Docker credentials')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()])
  const parsed = JSON.parse(plaintext.toString('utf8')) as Partial<DockerTlsCredentials>
  if (typeof parsed.ca !== 'string' || typeof parsed.cert !== 'string' || typeof parsed.key !== 'string') {
    throw new Error('Invalid Docker TLS credential payload')
  }
  return { ca: parsed.ca, cert: parsed.cert, key: parsed.key }
}

export function validateRemoteDockerEndpoint(input: string, env = process.env): URL {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Remote Docker endpoint must be a valid HTTPS URL') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Remote Docker endpoint must be HTTPS without credentials, path, query, or fragment')
  }
  if (url.port && url.port !== '2376') throw new Error('Remote Docker endpoint must use the standard TLS port 2376')
  const host = url.hostname.toLowerCase()
  if (!host || isIP(host.replace(/^\[|\]$/g, '')) || host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) {
    throw new Error('Remote Docker endpoint host is not allowed')
  }
  const allowlist = (env.DOCKER_REMOTE_ALLOWED_HOSTS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  if (!allowlist.includes(host)) throw new Error('Remote Docker endpoint host is not in DOCKER_REMOTE_ALLOWED_HOSTS')
  return url
}

export function validateTlsCredentials(value: unknown): DockerTlsCredentials {
  if (!value || typeof value !== 'object') throw new Error('Remote Docker TLS credentials are required')
  const candidate = value as Record<string, unknown>
  const { ca, cert, key } = candidate
  if ([ca, cert, key].some((part) => typeof part !== 'string' || !part.trim() || Buffer.byteLength(part, 'utf8') > 65536)) {
    throw new Error('Docker CA, client certificate, and private key are required (maximum 64 KiB each)')
  }
  return { ca: ca as string, cert: cert as string, key: key as string }
}
