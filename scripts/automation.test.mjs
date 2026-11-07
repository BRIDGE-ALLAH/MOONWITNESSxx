import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidCommitSubject } from './check-commit-message.mjs'

test('accepts conventional commit subjects with and without scopes', () => {
  assert.equal(isValidCommitSubject('feat: add account settings'), true)
  assert.equal(isValidCommitSubject('fix(arsy): handle shutdown signal'), true)
  assert.equal(isValidCommitSubject('chore(ci): pin workflow toolchain'), true)
})

test('rejects subjects without a conventional type', () => {
  assert.equal(isValidCommitSubject('update the app'), false)
  assert.equal(isValidCommitSubject('feature: add dashboard'), false)
})

test('accepts subjects at the 72-character limit', () => {
  assert.equal(isValidCommitSubject(`chore: ${'x'.repeat(65)}`), true)
})

test('rejects subjects longer than 72 characters', () => {
  assert.equal(
    isValidCommitSubject(`chore: ${'x'.repeat(66)}`),
    false
  )
})
