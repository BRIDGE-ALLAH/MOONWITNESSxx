import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
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
    shortName: 'arsy-core',
    directory: 'packages/arsy-core',
    entrypoint: 'src/index.ts',
    exports: {
      '.': { types: './src/index.ts', import: './dist/index.js' },
      './evidence': { types: './src/evidence/types.ts', import: './dist/evidence/types.js' },
    },
  },
  {
    name: '@riotworks/contract',
    shortName: 'contract',
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


function patchDeployedPackage(deployRoot, item) {
  const packageLink = resolve(deployRoot, 'node_modules', '@riotworks', item.shortName)
  if (!existsSync(packageLink)) {
    throw new Error(`pnpm deploy did not include ${item.name} at ${packageLink}`)
  }

  const packageRoot = realpathSync(packageLink)
  const distSource = resolve(workspaceRoot, item.directory, 'dist')
  const distTarget = resolve(packageRoot, 'dist')
  cpSync(distSource, distTarget, { recursive: true, force: true })
  if (!existsSync(resolve(distTarget, 'index.js'))) {
    throw new Error(`Deployed package is missing compiled JavaScript: ${item.name}`)
  }

  const manifestPath = resolve(packageRoot, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== item.name || manifest.private !== true) {
    throw new Error(`Unexpected deployed package identity for ${item.name}`)
  }

  manifest.main = './dist/index.js'
  manifest.type = 'module'
  if (item.exports) manifest.exports = item.exports
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`Patched deployed JavaScript package: ${item.name} -> ${packageRoot}\n`)
}

if (process.argv[2] === '--deployed-root') {
  const deployRoot = resolve(process.argv[3] ?? '/out/arsy')
  for (const item of packages) patchDeployedPackage(deployRoot, item)
}
