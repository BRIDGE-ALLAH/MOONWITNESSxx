import assert from 'node:assert/strict'
import test from 'node:test'
import { isPrettierSupportedFile, uniqueFilePaths } from './check-format.mjs'

test('recognizes supported source and configuration files', () => {
  assert.equal(isPrettierSupportedFile('apps/headquarter/src/page.tsx'), true)
  assert.equal(isPrettierSupportedFile('.github/dependabot.yml'), true)
  assert.equal(isPrettierSupportedFile('.github/workflows/ci.yml'), false)
  assert.equal(isPrettierSupportedFile('README.md'), true)
})

test('ignores generated and binary files', () => {
  assert.equal(isPrettierSupportedFile('pnpm-lock.yaml'), false)
  assert.equal(isPrettierSupportedFile('public/logo.png'), false)
  assert.equal(isPrettierSupportedFile('assets/font.woff2'), false)
})

test('deduplicates and sorts file paths', () => {
  assert.deepEqual(uniqueFilePaths(['b.ts', 'a.ts', 'b.ts', '']), ['a.ts', 'b.ts'])
})
