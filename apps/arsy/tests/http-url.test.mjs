import assert from 'node:assert/strict'
import test from 'node:test'
import { httpEvidenceUrlSchema } from '../src/http-url.ts'

test('accepts absolute HTTP and HTTPS evidence URLs', () => {
  for (const value of [
    'https://example.com/source',
    'http://example.com/source?edition=1',
    'https://example.com/a%20b#section',
  ]) {
    assert.equal(httpEvidenceUrlSchema.safeParse(value).success, true, value)
  }
})

test('rejects executable, local, data and non-web URL schemes', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/source',
    'mailto:research@example.com',
    '//example.com/source',
  ]) {
    assert.equal(httpEvidenceUrlSchema.safeParse(value).success, false, value)
  }
})

test('rejects malformed and credential-bearing HTTP(S) URLs', () => {
  for (const value of [
    'not-a-url',
    'https://user:password@example.com/source',
    'http://:secret@example.com/source',
  ]) {
    assert.equal(httpEvidenceUrlSchema.safeParse(value).success, false, value)
  }
})

test('trims outer whitespace before returning a canonical web URL', () => {
  const result = httpEvidenceUrlSchema.safeParse('  https://example.com/source  ')
  assert.equal(result.success, true)
  assert.equal(result.data, 'https://example.com/source')
})
