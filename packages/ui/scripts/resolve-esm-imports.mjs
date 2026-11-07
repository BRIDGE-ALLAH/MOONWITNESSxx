import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outputDirectory = new URL('../dist/', import.meta.url)

async function rewriteDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      await rewriteDirectory(path)
      continue
    }

    if (!entry.isFile() || !(entry.name.endsWith('.js') || entry.name.endsWith('.d.ts'))) {
      continue
    }

    const source = await readFile(path, 'utf8')
    const rewritten = source.replace(
      /(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"]+)(['"])/g,
      (match, prefix, openingQuote, specifier, closingQuote) => {
        if (/\.[a-z\d]+$/i.test(specifier)) return match
        return `${prefix}${openingQuote}${specifier}.js${closingQuote}`
      }
    )

    if (rewritten !== source) {
      await writeFile(path, rewritten)
    }
  }
}

await rewriteDirectory(outputDirectory.pathname)
console.log('Rewrote relative ESM imports to explicit .js specifiers.')
