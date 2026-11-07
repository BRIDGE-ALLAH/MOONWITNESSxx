import test from 'node:test'
import assert from 'node:assert/strict'
import { GET as downloadAsset } from '../src/app/api/assets/[id]/download/route.ts'
import { GET as getAsset } from '../src/app/api/assets/[id]/route.ts'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const token = 'test-only-arsy-service-token'
const operatorId = 'operator-test'
const origin = 'https://hq.example'
const id = '9c4a1ef2-3b7d-4e5f-8a91-0b2c3d4e5f67'
function configureEnvironment() {
  const keys = ['ARSY_API_BASE_URL', 'ARSY_OPERATOR_TOKEN', 'ARSY_OPERATOR_ID', 'HEADQUARTER_OPERATOR_PASSWORD', 'HEADQUARTER_SESSION_SECRET', 'HEADQUARTER_PUBLIC_ORIGIN']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, {
    ARSY_API_BASE_URL: 'https://arsy.internal',
    ARSY_OPERATOR_TOKEN: token,
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: 'test-only-operator-password',
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: origin,
  })
  return () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}
const cookie = () => `${OPERATOR_SESSION_COOKIE}=${createOperatorSession(operatorId, secret)}`
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })

test('asset download proxy preserves private attachment headers and exact bytes', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  const bytes = Buffer.from([0, 1, 2, 3, 255, 128])
  let upstreamUrl = ''
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    assert.equal(options.method, 'GET')
    assert.equal(options.headers['x-arsy-operator-token'], token)
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': 'attachment; filename="private.bin"',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  }
  try {
    const response = await downloadAsset(new Request(`${origin}/api/assets/${id}/download`, {
      headers: { cookie: cookie() },
    }), context())
    assert.equal(response.status, 200)
    assert.equal(upstreamUrl, `https://arsy.internal/api/v1/assets/${id}/download`)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="private.bin"')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('asset metadata proxy rejects anonymous requests and invalid UUIDs', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; return new Response('{}') }
  try {
    const anonymous = await getAsset(new Request(`${origin}/api/assets/${id}`), context())
    assert.equal(anonymous.status, 401)
    const invalid = await getAsset(new Request(`${origin}/api/assets/not-a-uuid`, {
      headers: { cookie: cookie() },
    }), context('not-a-uuid'))
    assert.equal(invalid.status, 400)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
