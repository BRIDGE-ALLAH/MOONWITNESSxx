import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

test('gate app contract & components integrity', async (t) => {
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

  await t.test('custom UI components exist and export valid contracts', () => {
    const statusPath = path.join(appRoot, 'src/components/StatusIndicator.tsx')
    const cardPath = path.join(appRoot, 'src/components/UniverseCard.tsx')
    const navPath = path.join(appRoot, 'src/components/GateNavbar.tsx')

    assert.ok(fs.existsSync(statusPath), 'StatusIndicator component must exist')
    assert.ok(fs.existsSync(cardPath), 'UniverseCard component must exist')
    assert.ok(fs.existsSync(navPath), 'GateNavbar component must exist')

    const statusContent = fs.readFileSync(statusPath, 'utf-8')
    assert.match(statusContent, /export function StatusIndicator/)
    assert.match(statusContent, /export type SystemStatus/)

    const cardContent = fs.readFileSync(cardPath, 'utf-8')
    assert.match(cardContent, /export function UniverseCard/)
    assert.match(cardContent, /@riotworks\/ui/)

    const navContent = fs.readFileSync(navPath, 'utf-8')
    assert.match(navContent, /export function GateNavbar/)
  })
})
