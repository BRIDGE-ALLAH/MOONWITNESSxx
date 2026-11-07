import assert from 'node:assert/strict'
import test from 'node:test'
import { filterPrettierFiles } from './format-changed.mjs'

test('keeps supported text and configuration files', () => {
  assert.deepEqual(
    filterPrettierFiles(['README.md', 'src/index.ts', 'config.yml', 'image.png']),
    ['README.md', 'src/index.ts', 'config.yml']
  )
})

test('deduplicates changed paths and ignores unsupported files', () => {
  assert.deepEqual(
    filterPrettierFiles(['a.ts', 'a.ts', 'asset.svg', 'styles.css']),
    ['a.ts', 'styles.css']
  )
})
