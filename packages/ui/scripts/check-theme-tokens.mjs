import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const stylesheet = fileURLToPath(new URL('../src/styles/globals.css', import.meta.url))
const css = await readFile(stylesheet, 'utf8')

const requiredTokens = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground',
  'success', 'success-foreground', 'warning', 'warning-foreground', 'danger', 'danger-foreground',
  'info', 'info-foreground', 'neutral', 'neutral-foreground', 'destructive', 'destructive-foreground',
  'surface-canvas', 'surface-elevated', 'surface-panel', 'surface-secondary', 'surface-inset',
  'surface-overlay', 'surface-scrim', 'border', 'border-strong', 'border-subtle', 'input', 'ring',
  'focus', 'hover', 'pressed', 'selected', 'disabled', 'muted', 'muted-foreground', 'radius',
  'radius-control', 'radius-panel',
]

function getBlock(selector) {
  const selectorIndex = css.indexOf(selector)
  if (selectorIndex < 0) throw new Error(`Missing theme selector: ${selector}`)

  const openIndex = css.indexOf('{', selectorIndex)
  if (openIndex < 0) throw new Error(`Missing opening brace for ${selector}`)

  let depth = 0
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    if (depth === 0) return css.slice(openIndex + 1, index)
  }

  throw new Error(`Unclosed theme block: ${selector}`)
}

function declaredTokens(block) {
  return new Set([...block.matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1]))
}

const themes = [
  { name: 'Paper Riot', selector: ':root' },
  { name: 'Night Riot', selector: '.dark' },
]

for (const theme of themes) {
  const declared = declaredTokens(getBlock(theme.selector))
  const missing = requiredTokens.filter((token) => !declared.has(token))
  if (missing.length > 0) {
    throw new Error(`${theme.name} is missing semantic tokens: ${missing.join(', ')}`)
  }
}

console.log(`Theme token contract passed for ${themes.length} themes (${requiredTokens.length} required tokens each).`)
