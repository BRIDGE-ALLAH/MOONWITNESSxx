import test from 'node:test'
import assert from 'node:assert/strict'
import { httpUrlSchema } from '../src/http-url.ts'

test('canonical evidence URLs accept absolute HTTP and HTTPS links', () => {
  assert.equal(httpUrlSchema.safeParse('http://example.com/source').success, true)
  assert.equal(httpUrlSchema.safeParse('https://example.com/source?q=1').success, true)
})

test('canonical evidence URLs reject executable, local and credential-bearing schemes', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'file:///etc/passwd',
    'ftp://example.com/source',
    'not-a-url',
    'https://user:pass@example.com/source',
  ]) {
    assert.equal(httpUrlSchema.safeParse(value).success, false, value)
  }
})
