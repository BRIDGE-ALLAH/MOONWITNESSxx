import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compiler = resolve(workspaceRoot, 'apps/arsy/node_modules/.bin/tsc')
const typeRoots = resolve(workspaceRoot, 'apps/arsy/node_modules/@types')

if (!existsSync(compiler)) {
  throw new Error('ARSY TypeScript compiler was not installed in the build workspace')
}

const packages = [
  {
    name: '@riotworks/arsy-core',
    directory: 'packages/arsy-core',
    entrypoint: 'src/index.ts',
    exports: {
      '.': { types: './src/index.ts', import: './dist/index.js' },
      './evidence': { types: './src/evidence/types.ts', import: './dist/evidence/types.js' },
    },
  },
  {
    name: '@riotworks/contract',
    directory: 'packages/contract',
    entrypoint: 'src/index.ts',
    exports: null,
  },
]

for (const item of packages) {
  const packageRoot = resolve(workspaceRoot, item.directory)
  const entrypoint = resolve(packageRoot, item.entrypoint)
  const output = resolve(packageRoot, 'dist')

  if (!existsSync(entrypoint)) {
    throw new Error(`Missing production package entrypoint: ${item.name} (${entrypoint})`)
  }

  execFileSync(compiler, [
    item.entrypoint,
    '--target', 'ES2022',
    '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext',
    '--strict',
    '--skipLibCheck',
    '--esModuleInterop',
    '--rewriteRelativeImportExtensions',
    '--removeComments',
    '--declaration', 'false',
    '--sourceMap', 'false',
    '--types', 'node',
    '--typeRoots', typeRoots,
    '--rootDir', 'src',
    '--outDir', 'dist',
  ], { cwd: packageRoot, stdio: 'inherit' })

  const outputEntrypoint = resolve(output, 'index.js')
  if (!existsSync(outputEntrypoint)) {
    throw new Error(`TypeScript build did not emit the production entrypoint for ${item.name}`)
  }

  const manifestPath = resolve(packageRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== item.name || manifest.private !== true) {
    throw new Error(`Unexpected workspace package identity for ${item.name}`)
  }

  manifest.main = './dist/index.js'
  manifest.type = 'module'
  if (item.exports) {
    manifest.exports = item.exports
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`Prepared production JavaScript package: ${item.name}\n`)
}
