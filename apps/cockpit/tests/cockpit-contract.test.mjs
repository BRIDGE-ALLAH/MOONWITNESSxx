import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

test('cockpit app contract & desktop runtime integrity', async (t) => {
  await t.test('package.json defines correct name and desktop script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf-8'))
    assert.equal(pkg.name, '@riotworks/cockpit')
    assert.ok(pkg.scripts.dev)
    assert.ok(pkg.scripts.desktop)
    assert.ok(pkg.scripts['type-check'])
  })

  await t.test('desktop rust runtime files exist', () => {
    assert.ok(fs.existsSync(path.join(appRoot, 'src-tauri/Cargo.toml')), 'Cargo.toml must exist')
    assert.ok(fs.existsSync(path.join(appRoot, 'src-tauri/src/main.rs')), 'Rust main.rs must exist')

    const cargoContent = fs.readFileSync(path.join(appRoot, 'src-tauri/Cargo.toml'), 'utf-8')
    assert.match(cargoContent, /moonwitness-cockpit/)
    assert.match(cargoContent, /tokio/)
  })

  await t.test('frontend NOC components exist and export valid contracts', () => {
    const gridPath = path.join(appRoot, 'src/components/ServiceNodeGrid.tsx')
    const actionPath = path.join(appRoot, 'src/components/ActionControlPanel.tsx')
    const pagePath = path.join(appRoot, 'src/app/page.tsx')

    assert.ok(fs.existsSync(gridPath), 'ServiceNodeGrid must exist')
    assert.ok(fs.existsSync(actionPath), 'ActionControlPanel must exist')
    assert.ok(fs.existsSync(pagePath), 'Cockpit page must exist')

    const gridContent = fs.readFileSync(gridPath, 'utf-8')
    assert.match(gridContent, /export function ServiceNodeGrid/)

    const actionContent = fs.readFileSync(actionPath, 'utf-8')
    assert.match(actionContent, /export function ActionControlPanel/)
  })
})
