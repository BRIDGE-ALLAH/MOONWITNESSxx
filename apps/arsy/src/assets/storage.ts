import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ownerHashPattern = /^[a-f0-9]{64}$/

export class LocalAssetStorage {
  constructor(private readonly rootDirectory: string | undefined) {}

  private root(): string {
    if (!this.rootDirectory?.trim()) throw new Error('ARSY_ASSET_STORAGE_DIR_NOT_CONFIGURED')
    return path.resolve(this.rootDirectory)
  }

  private resolveKey(storageKey: string): string {
    const [ownerHash, assetId, extra] = storageKey.split('/')
    if (!ownerHashPattern.test(ownerHash ?? '') || !assetIdPattern.test(assetId ?? '') || extra) {
      throw new Error('INVALID_ASSET_STORAGE_KEY')
    }
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
    return { storageKey, checksumSha256: createHash('sha256').update(content).digest('hex') }
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(storageKey))
  }

  async delete(storageKey: string): Promise<void> {
    await unlink(this.resolveKey(storageKey)).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return
      throw error
    })
  }
}
