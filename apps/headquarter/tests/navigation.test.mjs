import test from 'node:test'
import assert from 'node:assert/strict'
import { NAVIGATION_ITEMS } from '../src/shell/navigation.ts'

test('Headquarter navigation contains unique routes and explicit disabled roadmap entries', () => {
  const routeItems = NAVIGATION_ITEMS.filter((item) => item.href !== null)
  const routePaths = routeItems.map((item) => item.href)

  assert.equal(new Set(routePaths).size, routePaths.length, 'navigation routes must be unique')
  assert.ok(NAVIGATION_ITEMS.filter((item) => item.status === 'planned').every((item) => item.href === null))
  assert.ok(NAVIGATION_ITEMS.filter((item) => item.href === null).every((item) => item.status === 'planned'))
})

test('Headquarter module maturity does not mislabel implemented integrations as demos', () => {
  const docker = NAVIGATION_ITEMS.find((item) => item.href === '/infrastructure/docker')
  const governance = NAVIGATION_ITEMS.find((item) => item.href === '/governance-lab')
  const prototype = NAVIGATION_ITEMS.find((item) => item.href === '/signal-room')

  assert.equal(docker?.status, 'connected')
  assert.equal(governance?.status, 'partial')
  assert.equal(prototype?.status, 'prototype')
})
