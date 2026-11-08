import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('gate universe experiences and portal contracts', async (t) => {
  await t.test('page.tsx registers exactly 9 universe experiences', () => {
    const pagePath = path.resolve('src/app/page.tsx')
    const content = fs.readFileSync(pagePath, 'utf8')

    assert.match(content, /id:\s*'gate'/, 'Gate experience must be present')
    assert.match(content, /id:\s*'dock'/, 'Dock experience must be present')
    assert.match(content, /id:\s*'headquarter'/, 'Headquarter experience must be present')
    assert.match(content, /id:\s*'id'/, 'ID experience must be present')
    assert.match(content, /id:\s*'observatory'/, 'Observatory experience must be present')
    assert.match(content, /id:\s*'moonsky'/, 'Moonsky experience must be present')
    assert.match(content, /id:\s*'harbor'/, 'Harbor experience must be present')
    assert.match(content, /id:\s*'cockpit'/, 'Cockpit experience must be present')
    assert.match(content, /id:\s*'e-isp'/, 'E-ISP experience must be present')

    // Verify operational application bindings
    assert.match(content, /http:\/\/localhost:3000/, 'Headquarter port must be 3000')
    assert.match(content, /http:\/\/localhost:3001/, 'Gate port must be 3001')
    assert.match(content, /http:\/\/localhost:3002/, 'Cockpit port must be 3002')
    assert.match(content, /http:\/\/localhost:3003/, 'ID port must be 3003')
  })

  await t.test('UniverseCard renders proper accessibility attributes', () => {
    const cardPath = path.resolve('src/components/UniverseCard.tsx')
    const content = fs.readFileSync(cardPath, 'utf8')

    assert.match(content, /aria-label=/, 'UniverseCard links must provide aria-label')
    assert.match(content, /focus:ring/, 'Interactive elements must provide keyboard focus rings')
  })
})
