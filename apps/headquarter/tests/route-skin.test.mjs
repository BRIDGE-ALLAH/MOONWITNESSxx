import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolveHeadquarterSkin } from '../src/shell/route-skin.ts'

test('SIDRA Archive routes resolve to the Archive skin', () => {
  for (const pathname of ['/sidra-archive', '/sidra-archive/', '/sidra-archive/records/one', '/sidra-archive/records/one?tab=evidence#source']) {
    assert.deepEqual(resolveHeadquarterSkin(pathname), {
      skin: 'archive',
      mode: 'light',
      density: 'comfortable',
    })
  }
})

test('operational and unknown routes resolve to Observatory', () => {
  for (const pathname of [undefined, null, '/', '/arsy-deck', '/signal-room', '/settings-policy', '/unknown-route']) {
    assert.deepEqual(resolveHeadquarterSkin(pathname), {
      skin: 'observatory',
      mode: 'dark',
      density: 'comfortable',
    })
  }
})

test('Headquarter applies the active next-themes mode without replacing the route skin', async () => {
  const shell = await readFile(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8')
  const archivePage = await readFile(new URL('../src/app/sidra-archive/page.tsx', import.meta.url), 'utf8')
  assert.match(shell, /usePathname/)
  assert.match(shell, /resolveHeadquarterSkin\(pathname\)/)
  assert.match(shell, /<SkinRoot/)
  assert.match(shell, /mode=\{mode\}/)
  assert.match(shell, /setTheme\(isDark \? 'light' : 'dark'\)/)
  assert.match(layout, /defaultTheme="system"/)
  assert.doesNotMatch(archivePage, /theme-archive/)
})
