import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { ArsyApiError, arsyRequest } from '../src/platform/arsy/client.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

test('sends safe defaults and returns a successful JSON response', async () => {
  let request
  globalThis.fetch = async (_url, init) => {
    request = init
    return jsonResponse({ ok: true })
  }

  const result = await arsyRequest('health')

  assert.deepEqual(result, { ok: true })
  assert.equal(request.method, 'GET')
  assert.equal(request.credentials, 'include')
  assert.equal(request.cache, 'no-store')
  assert.equal(new Headers(request.headers).get('accept'), 'application/json')
  assert.ok(new Headers(request.headers).get('x-request-id'))
})

test('retries transient GET responses and then returns the successful result', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return calls === 1 ? jsonResponse({ message: 'temporary' }, 503) : jsonResponse({ ready: true })
  }

  const result = await arsyRequest('health', { retries: 1 })

  assert.deepEqual(result, { ready: true })
  assert.equal(calls, 2)
})

test('never retries a mutation even when retries are requested', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return jsonResponse({ error: { code: 'CONFLICT', message: 'Conflict' } }, 409)
  }

  await assert.rejects(
    arsyRequest('records', { method: 'POST', body: JSON.stringify({ name: 'sample' }), retries: 4 }),
    (error) => error instanceof ArsyApiError && error.status === 409 && error.code === 'CONFLICT',
  )
  assert.equal(calls, 1)
})

test('normalizes a non-JSON gateway error without exposing its body', async () => {
  globalThis.fetch = async () => new Response('<html>private gateway details</html>', { status: 502 })

  await assert.rejects(
    arsyRequest('health', { retries: 0 }),
    (error) => error instanceof ArsyApiError && error.status === 502 && !error.message.includes('private'),
  )
})

test('maps request timeout to a stable safe error', async () => {
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
  })

  await assert.rejects(
    arsyRequest('slow', { timeoutMs: 5, retries: 0 }),
    (error) => error instanceof ArsyApiError && error.code === 'TIMEOUT' && error.status === 0,
  )
})
