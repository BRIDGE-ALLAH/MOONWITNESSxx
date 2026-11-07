import test from 'node:test'
import assert from 'node:assert/strict'
import { GET, POST } from '../src/app/api/opportunities/route.ts'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const password = 'test-only-operator-password'
const token = 'test-only-arsy-service-token'
const operatorId = 'operator-test'
const origin = 'https://hq.example'

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
    HEADQUARTER_OPERATOR_PASSWORD: password,
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

test('opportunity proxy rejects anonymous GET and POST before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('fetch must not be called')
  }
  try {
    const get = await GET(new Request(`${origin}/api/opportunities`))
    const post = await POST(new Request(`${origin}/api/opportunities`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'unauthorized' }),
    }))
    assert.equal(get.status, 401)
    assert.equal(post.status, 401)
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('opportunity proxy rejects cross-origin mutation with a valid operator cookie', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('fetch must not be called')
  }
  try {
    const response = await POST(new Request(`${origin}/api/opportunities`, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        cookie: sessionCookie(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'cross-origin' }),
    }))
    assert.equal(response.status, 403)
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('authenticated same-origin operator GET forwards the server-only ARSY credential', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  process.env.ARSY_API_BASE_URL = 'https://arsy.internal///'
  let upstreamHeaders
  let upstreamUrl
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    upstreamHeaders = options.headers
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const response = await GET(new Request(`${origin}/api/opportunities`, {
      headers: { cookie: sessionCookie() },
    }))
    assert.equal(response.status, 200)
    assert.equal(upstreamUrl, 'https://arsy.internal/api/v1/opportunities')
    assert.equal(upstreamHeaders['x-arsy-operator-token'], token)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('authenticated same-origin operator POST forwards mutation after CSRF validation', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let forwardedBody
  let forwardedHeaders
  globalThis.fetch = async (_url, options) => {
    forwardedBody = options.body
    forwardedHeaders = options.headers
    return new Response(JSON.stringify({ data: { id: 'created-record' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const body = JSON.stringify({ title: 'authorized opportunity' })
    const response = await POST(new Request(`${origin}/api/opportunities`, {
      method: 'POST',
      headers: {
        origin,
        cookie: sessionCookie(),
        'content-type': 'application/json',
        'idempotency-key': 'opportunity-proxy-test-0001',
      },
      body,
    }))
    assert.equal(response.status, 201)
    assert.equal(forwardedBody, body)
    assert.equal(forwardedHeaders['idempotency-key'], 'opportunity-proxy-test-0001')
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
