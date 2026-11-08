import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface AssetStorage {
  put(key: string, bytes: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

export class LocalAssetStorage implements AssetStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  private resolveKey(key: string): string {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('INVALID_STORAGE_KEY')
    const target = path.resolve(this.root, key)
    const relative = path.relative(this.root, target)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('INVALID_STORAGE_KEY')
    return target
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await writeFile(this.resolveKey(key), bytes, { flag: 'wx', mode: 0o600 })
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key))
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

export function createAssetStorage(env: NodeJS.ProcessEnv = process.env): AssetStorage {
  const driver = env.ASSET_STORAGE_DRIVER?.trim() || (env.NODE_ENV === 'production' ? 'unconfigured' : 'local')
  if (driver !== 'local') {
    throw new Error('ASSET_STORAGE_NOT_CONFIGURED: use the persistent local volume adapter or implement an approved object-storage provider.')
  }
  const configuredRoot = env.ASSET_STORAGE_PATH?.trim()
  if (env.NODE_ENV === 'production' && !configuredRoot) {
    throw new Error('ASSET_STORAGE_PATH is required when local asset storage is used in production.')
  }
  return new LocalAssetStorage(configuredRoot || path.resolve(process.cwd(), '.data/arsy-assets'))
}
