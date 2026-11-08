import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('apps/id app contract & configuration integrity', async (t) => {
  const appRoot = process.cwd()

  await t.test('package.json defines correct scripts and workspace dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
    assert.equal(pkg.name, '@riotworks/id')
    assert.match(pkg.scripts.dev, /3003/)
    assert.match(pkg.scripts.start, /3003/)
    assert.ok(pkg.dependencies['@riotworks/ui'])
    assert.ok(pkg.dependencies['@riotworks/contract'])
  })

  await t.test('Next.js API routes and pages exist', () => {
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/page.tsx')))
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/api/auth/token/route.ts')))
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/api/auth/verify/route.ts')))
    assert.ok(fs.existsSync(path.join(appRoot, 'src/lib/session.ts')))
  })
})
