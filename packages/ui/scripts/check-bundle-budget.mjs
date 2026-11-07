import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const budgetBytes = 600 * 1024

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collect(path) : path.endsWith('.js') ? [path] : []
  }))
  return files.flat()
}

const files = await collect(root)
const sizes = await Promise.all(files.map(async (file) => ({ file, bytes: (await stat(file)).size })))
const total = sizes.reduce((sum, file) => sum + file.bytes, 0)
if (total > budgetBytes) throw new Error('UI JavaScript bundle budget exceeded: ' + total + ' bytes > ' + budgetBytes + ' bytes')
console.log('UI JavaScript size budget passed: ' + total + ' / ' + budgetBytes + ' bytes across ' + files.length + ' files.')
