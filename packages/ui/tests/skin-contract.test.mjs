import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const registry = await readFile(new URL('../src/skin/registry.ts', import.meta.url), 'utf8')
const resolver = await readFile(new URL('../src/skin/resolve.ts', import.meta.url), 'utf8')
const skinRoot = await readFile(new URL('../src/skin/skin-root.tsx', import.meta.url), 'utf8')
const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
const stylesheet = await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')

test('the static registry defines exactly the three canonical MOONWITNESS skins', () => {
  for (const skin of ['observatory', 'archive', 'signal']) {
    assert.match(registry, new RegExp('^\\s*' + skin + ':\\s*\\{', 'm'))
    assert.match(stylesheet, new RegExp('data-mw-skin=["'] + skin + '["']'))
  }
  assert.match(registry, /satisfies Record<SkinName, SkinDefinition>/)
})

test('each initial skin only advertises an explicitly supported appearance mode', () => {
  assert.match(registry, /observatory:[\\s\\S]*?defaultMode: 'dark',[\\s\\S]*?supportedModes: \\['dark'\\]/)
  assert.match(registry, /archive:[\\s\\S]*?defaultMode: 'light',[\\s\\S]*?supportedModes: \\['light'\\]/)
  assert.match(registry, /signal:[\\s\\S]*?defaultMode: 'dark',[\\s\\S]*?supportedModes: \\['dark'\\]/)
})

test('resolver has deterministic fallbacks for unknown skin, mode, and density', () => {
  assert.match(resolver, /DEFAULT_SKIN/)
  assert.match(resolver, /unknown-skin/)
  assert.match(resolver, /unsupported-mode/)
  assert.match(resolver, /unknown-mode/)
  assert.match(resolver, /unknown-density/)
})

test('SkinRoot writes resolved skin, mode, density, and fallback metadata', () => {
  assert.match(skinRoot, /data-mw-skin=\{config\.skin\}/)
  assert.match(skinRoot, /data-mw-mode=\{config\.mode\}/)
  assert.match(skinRoot, /data-mw-density=\{config\.density\}/)
  assert.match(skinRoot, /data-mw-fallback=\{fallback\}/)
  assert.match(index, /SkinRoot/)
})

test('every skin selector keeps semantic status tokens separate from expressive accents', () => {
  for (const token of [
    'background', 'foreground', 'primary', 'primary-foreground',
    'destructive', 'destructive-foreground', 'success', 'success-foreground',
    'warning', 'warning-foreground', 'info', 'info-foreground',
    'border', 'input', 'ring', 'focus',
  ]) {
    assert.match(stylesheet, new RegExp('--' + token + ':'))
  }
  assert.match(stylesheet, /--mw-skin-graphic-accent:/)
  assert.match(stylesheet, /--mw-skin-heading-transform:/)
})
