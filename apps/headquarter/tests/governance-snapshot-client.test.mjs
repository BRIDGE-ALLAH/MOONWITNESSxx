import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  archiveSnapshot,
  createSnapshot,
  describeGovernanceError,
  getSnapshot,
  GovernanceApiError,
  listSnapshots,
} from '../src/features/governance-lab/snapshot-client.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('listSnapshots reads the BFF list endpoint without caching', async () => {
  let captured
  globalThis.fetch = async (url, init) => {
    captured = { url, init }
    return jsonResponse({
      data: {
        snapshots: [
          { id: 's1', label: 'Review', createdAt: '2026-11-08T00:00:00Z', archivedAt: null },
        ],
      },
    })
  }
  const result = await listSnapshots()
  assert.equal(captured.url, '/api/governance/snapshots')
  assert.equal(captured.init.cache, 'no-store')
  assert.equal(result.snapshots[0].id, 's1')
})

test('createSnapshot posts JSON and returns the persisted record', async () => {
  let captured
  globalThis.fetch = async (url, init) => {
    captured = { url, init }
    return jsonResponse({ data: { snapshot: { id: 'created-id' } } }, 201)
  }
  const input = { label: 'Review' }
  const result = await createSnapshot(input)
  assert.equal(captured.url, '/api/governance/snapshots')
  assert.equal(captured.init.method, 'POST')
  assert.equal(captured.init.headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(captured.init.body), input)
  assert.equal(result.snapshot.id, 'created-id')
})

test('getSnapshot and archiveSnapshot encode the snapshot id', async () => {
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(url)
    return jsonResponse({ data: { snapshot: { id: 'x' } } })
  }
  await getSnapshot('a/b')
  await archiveSnapshot('a/b')
  assert.deepEqual(urls, [
    '/api/governance/snapshots/a%2Fb',
    '/api/governance/snapshots/a%2Fb/archive',
  ])
})

test('API errors carry the server error code and status', async () => {
  globalThis.fetch = async () =>
    jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }, 401)
  await assert.rejects(listSnapshots(), (error) => {
    assert.ok(error instanceof GovernanceApiError)
    assert.equal(error.code, 'UNAUTHENTICATED')
    assert.equal(error.status, 401)
    return true
  })
})

test('network failures are reported honestly, never as success', async () => {
  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  await assert.rejects(listSnapshots(), (error) => {
    assert.ok(error instanceof GovernanceApiError)
    assert.equal(error.code, 'NETWORK_ERROR')
    return true
  })
})

test('error descriptions guide the operator toward the real fix', () => {
  assert.match(
    describeGovernanceError(new GovernanceApiError('UNAUTHENTICATED', '', 401)),
    /operator session/i
  )
  assert.match(
    describeGovernanceError(new GovernanceApiError('ARSY_NOT_CONFIGURED', '', 503)),
    /environment variables/i
  )
  assert.match(
    describeGovernanceError(new GovernanceApiError('GOVERNANCE_STORE_UNAVAILABLE', '', 503)),
    /migration 008/i
  )
  assert.match(describeGovernanceError(new Error('boom')), /went wrong/i)
})
