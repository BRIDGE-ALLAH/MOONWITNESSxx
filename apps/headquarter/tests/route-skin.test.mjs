import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolveHeadquarterSkin } from '../src/shell/route-skin.ts'

const appShell = await readFile(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8')

test('operational routes use Observatory by default', () => {
  for (const path of ['/', '/dashboard', '/settings', '/arsy/opportunities', '/cockpit']) {
    assert.deepEqual(resolveHeadquarterSkin(path), { skin: 'observatory', mode: 'dark', density: 'comfortable' })
  }
})

test('SIDRA Archive routes use the reading-first Archive skin', () => {
  for (const path of ['/sidra-archive', '/sidra-archive/records', '/sidra-archive/item/123']) {
    assert.deepEqual(resolveHeadquarterSkin(path), { skin: 'archive', mode: 'light', density: 'comfortable' })
  }
})

test('route matching ignores query strings, hashes and trailing slashes', () => {
  assert.equal(resolveHeadquarterSkin('/sidra-archive/records/?q=moon#source').skin, 'archive')
  assert.equal(resolveHeadquarterSkin(null).skin, 'observatory')
})

test('AppShell applies route skin and keeps user appearance switching connected', () => {
  assert.match(appShell, /usePathname/)
  assert.match(appShell, /resolveHeadquarterSkin\(pathname\)/)
  assert.match(appShell, /<SkinRoot skin=\{routeSkin\.skin\} mode=\{activeMode\}/)
  assert.match(appShell, /setTheme\(routeSkin\.mode\)/)
  assert.match(appShell, /onToggleTheme=\{\(\) => setTheme\(isDark \? 'light' : 'dark'\)\}/)
})
