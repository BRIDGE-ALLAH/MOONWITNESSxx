import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

test('gate app contract integrity', async (t) => {
  await t.test('package.json defines correct name and scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf-8'))
    assert.equal(pkg.name, '@riotworks/gate')
    assert.ok(pkg.scripts.dev)
    assert.ok(pkg.scripts.build)
    assert.ok(pkg.scripts['type-check'])
  })

  await t.test('core entry files exist', () => {
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/layout.tsx')))
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/page.tsx')))
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/globals.css')))
    assert.ok(fs.existsSync(path.join(appRoot, 'next.config.ts')))
    assert.ok(fs.existsSync(path.join(appRoot, 'tsconfig.json')))
  })
})
