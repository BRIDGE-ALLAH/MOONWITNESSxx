import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const registry = await readFile(new URL('../src/skin/registry.ts', import.meta.url), 'utf8')
const resolver = await readFile(new URL('../src/skin/resolve.ts', import.meta.url), 'utf8')
const skinRoot = await readFile(new URL('../src/skin/skin-root.tsx', import.meta.url), 'utf8')
const index = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
const stylesheet = await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')

function readRule(source, selector) {
  const start = source.indexOf(selector)
  assert.notEqual(start, -1, `Missing selector: ${selector}`)
  const open = source.indexOf('{', start)
  assert.notEqual(open, -1, `Missing declaration block: ${selector}`)

  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }
  assert.fail(`Unclosed declaration block: ${selector}`)
}

const requiredTokens = [
  'background', 'foreground', 'card', 'card-foreground',
  'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground',
  'success', 'success-foreground', 'warning', 'warning-foreground',
  'info', 'info-foreground', 'border', 'input', 'ring', 'focus', 'overlay',
]

test('the static registry defines exactly the three canonical MOONWITNESS skins', () => {
  for (const skin of ['observatory', 'archive', 'signal']) {
    assert.ok(registry.includes(`  ${skin}: {`), `Registry is missing ${skin}`)
    assert.ok(stylesheet.includes(`[data-mw-skin="${skin}"`), `CSS is missing ${skin}`)
  }
  assert.match(registry, /satisfies Record<SkinName, SkinDefinition>/)
})

test('each initial skin only advertises an explicitly supported appearance mode', () => {
  const expected = { observatory: 'dark', archive: 'light', signal: 'dark' }
  const names = Object.keys(expected)
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]
    const nextName = names[index + 1]
    const start = registry.indexOf(`  ${name}: {`)
    const end = nextName ? registry.indexOf(`  ${nextName}: {`, start) : registry.indexOf('\n} as const')
    const section = registry.slice(start, end)
    assert.match(section, new RegExp(`defaultMode: '${expected[name]}'`))
    assert.match(section, new RegExp(`supportedModes: \\\\[ '${expected[name]}' \\\\]`.replaceAll(' ', '')))
  }
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

test('all skin profiles define the full semantic token set', () => {
  const selectors = [
    '[data-mw-skin="observatory"][data-mw-mode="dark"]',
    '[data-mw-skin="archive"][data-mw-mode="light"]',
    '[data-mw-skin="signal"][data-mw-mode="dark"]',
  ]
  for (const selector of selectors) {
    const block = readRule(stylesheet, selector)
    for (const token of requiredTokens) {
      assert.match(block, new RegExp(`--${token}:`), `${selector} is missing --${token}`)
    }
    assert.match(block, /--mw-skin-graphic-accent:/)
    assert.match(block, /--mw-skin-heading-transform:/)
  }
})
