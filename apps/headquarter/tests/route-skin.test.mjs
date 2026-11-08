import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHeadquarterSkin } from '../src/shell/route-skin.ts'

test('SIDRA Archive and nested record routes use the Archive light profile', () => {
  const expected = { skin: 'archive', mode: 'light', density: 'comfortable' }
  assert.deepEqual(resolveHeadquarterSkin('/sidra-archive'), expected)
  assert.deepEqual(resolveHeadquarterSkin('/sidra-archive/asset/asset-001'), expected)
  assert.deepEqual(resolveHeadquarterSkin('/sidra-archive/'), expected)
})

test('operational, research, and internal specimen routes use Observatory dark', () => {
  const expected = { skin: 'observatory', mode: 'dark', density: 'comfortable' }
  for (const path of ['/', '/arsy-deck', '/signal-room', '/riot-engine', '/ui-lab/skin-system']) {
    assert.deepEqual(resolveHeadquarterSkin(path), expected, path)
  }
})

test('missing paths fail safely to the Observatory profile', () => {
  const expected = { skin: 'observatory', mode: 'dark', density: 'comfortable' }
  assert.deepEqual(resolveHeadquarterSkin(null), expected)
  assert.deepEqual(resolveHeadquarterSkin(undefined), expected)
})
