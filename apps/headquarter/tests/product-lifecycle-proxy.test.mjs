import test from 'node:test'
import assert from 'node:assert/strict'
import { PATCH } from '../src/app/api/products/[id]/lifecycle/route.ts'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const origin = 'https://hq.example'
const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const token = 'test-only-arsy-service-token'
const operatorId = 'operator-test'
const productId = '11111111-1111-4111-8111-111111111111'

function configureEnvironment() {
  const keys = [
    'ARSY_API_BASE_URL',
    'ARSY_OPERATOR_TOKEN',
    'ARSY_OPERATOR_ID',
    'HEADQUARTER_OPERATOR_PASSWORD',
    'HEADQUARTER_SESSION_SECRET',
    'HEADQUARTER_PUBLIC_ORIGIN',
  ]
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

function sessionCookie() {
  return `${OPERATOR_SESSION_COOKIE}=${createOperatorSession(operatorId, secret)}`
}
function context(id = productId) { return { params: Promise.resolve({ id }) } }

test('product lifecycle proxy rejects invalid identifiers before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('fetch must not be called') }
  try {
    const response = await PATCH(new Request(`${origin}/api/products/not-a-uuid`, {
      method: 'PATCH', headers: { origin, cookie: sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycleState: 'production' }),
    }), context('not-a-uuid'))
    assert.equal(response.status, 400)
    assert.equal(called, false)
  } finally { globalThis.fetch = originalFetch; restore() }
})

test('product lifecycle proxy rejects anonymous requests before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('fetch must not be called') }
  try {
    const response = await PATCH(new Request(`${origin}/api/products/${productId}/lifecycle`, {
      method: 'PATCH', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycleState: 'production' }),
    }), context())
    assert.equal(response.status, 401)
    assert.equal(called, false)
  } finally { globalThis.fetch = originalFetch; restore() }
})

test('product lifecycle proxy rejects cross-origin mutation with a valid operator cookie', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; throw new Error('fetch must not be called') }
  try {
    const response = await PATCH(new Request(`${origin}/api/products/${productId}/lifecycle`, {
      method: 'PATCH',
      headers: { origin: 'https://attacker.example', cookie: sessionCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycleState: 'production' }),
    }), context())
    assert.equal(response.status, 403)
    assert.equal(called, false)
  } finally { globalThis.fetch = originalFetch; restore() }
})

test('authenticated same-origin lifecycle PATCH forwards the body and server-only ARSY credential', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  const body = JSON.stringify({ lifecycleState: 'production' })
  let forwarded
  globalThis.fetch = async (url, options) => {
    forwarded = { url: String(url), options }
    return new Response(JSON.stringify({ data: { id: productId, lifecycleState: 'production' } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const response = await PATCH(new Request(`${origin}/api/products/${productId}/lifecycle`, {
      method: 'PATCH', headers: { origin, cookie: sessionCookie(), 'content-type': 'application/json' }, body,
    }), context())
    assert.equal(response.status, 200)
    assert.equal(forwarded.url, `https://arsy.internal/api/v1/products/${productId}/lifecycle`)
    assert.equal(forwarded.options.method, 'PATCH')
    assert.equal(forwarded.options.body, body)
    assert.equal(forwarded.options.headers['x-arsy-operator-token'], token)
    assert.equal((await response.json()).data.lifecycleState, 'production')
  } finally { globalThis.fetch = originalFetch; restore() }
})
