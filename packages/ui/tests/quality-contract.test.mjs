import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('both themes define the complete semantic token contract', async () => {
  const css = await read('../src/styles/globals.css')
  const required = [
    'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
    'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground',
    'success', 'success-foreground', 'warning', 'warning-foreground', 'danger', 'danger-foreground',
    'info', 'info-foreground', 'neutral', 'neutral-foreground', 'destructive', 'destructive-foreground',
    'surface-canvas', 'surface-elevated', 'surface-panel', 'surface-secondary', 'surface-inset',
    'surface-overlay', 'surface-scrim', 'border', 'border-strong', 'border-subtle', 'input', 'ring',
    'focus', 'hover', 'pressed', 'selected', 'disabled', 'muted', 'muted-foreground', 'radius',
    'radius-control', 'radius-panel',
  ]
  for (const selector of [':root', '.dark']) {
    const start = css.indexOf(selector)
    const open = css.indexOf('{', start)
    let depth = 0
    let end = -1
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1
      if (css[i] === '}') depth -= 1
      if (depth === 0) { end = i; break }
    }
    assert.ok(start >= 0 && end > open, 'theme block exists: ' + selector)
    const block = css.slice(open, end)
    for (const token of required) assert.match(block, new RegExp('--' + token + '\\s*:'), selector + ' defines --' + token)
  }
})

test('focus, motion, and brand atmosphere have accessible fallbacks', async () => {
  const css = await read('../src/styles/globals.css')
  const brand = await read('../src/components/brand-language.tsx')
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion:\\s*reduce/)
  assert.match(css, /\\.riot-atmosphere/)
  assert.match(css, /\\.riot-live-indicator/)
  assert.match(brand, /aria-hidden="true"/)
  assert.match(brand, /aria-live="polite"/)
})

test('brand language is part of the intentional public API', async () => {
  const entry = await read('../src/index.ts')
  assert.match(entry, /RiotSignalHeader/)
  assert.match(entry, /RiotLiveIndicator/)
  assert.match(entry, /RiotAtmosphere/)
})

test('the component workbench is documented and reachable in Headquarter', async () => {
  const docs = await read('../WORKBENCH.md')
  const page = await read('../../../apps/headquarter/src/app/ui-lab/page.tsx')
  assert.match(docs, /\\/ui-lab/)
  assert.match(page, /RiotSignalHeader/)
  assert.match(page, /RiotAtmosphere/)
})
