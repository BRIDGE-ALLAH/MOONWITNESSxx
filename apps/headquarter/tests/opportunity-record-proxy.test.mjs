import test from 'node:test'
import assert from 'node:assert/strict'
import { DELETE, GET, PATCH } from '../src/app/api/opportunities/[id]/route.ts'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const origin = 'https://hq.example'
const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const token = 'test-only-arsy-service-token'
const password = 'test-only-operator-password'
const operatorId = 'operator-test'
const opportunityId = '11111111-1111-4111-8111-111111111111'

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

function context(id = opportunityId) {
  return { params: Promise.resolve({ id }) }
}

test('opportunity record proxy rejects invalid identifiers before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('fetch must not be called')
  }
  try {
    const response = await GET(new Request(`${origin}/api/opportunities/not-a-uuid`), context('not-a-uuid'))
    assert.equal(response.status, 400)
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('opportunity record proxy rejects anonymous requests before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('fetch must not be called')
  }
  try {
    const response = await GET(new Request(`${origin}/api/opportunities/${opportunityId}`), context())
    assert.equal(response.status, 401)
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('authenticated opportunity PATCH forwards versioned body and server-only credential', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  const body = JSON.stringify({ expectedVersion: 2, input: { title: 'Updated opportunity' } })
  let forwarded
  globalThis.fetch = async (url, options) => {
    forwarded = { url: String(url), options }
    return new Response(JSON.stringify({ data: { id: opportunityId, version: 3 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const response = await PATCH(new Request(`${origin}/api/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: {
        origin,
        cookie: sessionCookie(),
        'content-type': 'application/json',
      },
      body,
    }), context())
    assert.equal(response.status, 200)
    assert.equal(forwarded.url, `https://arsy.internal/api/v1/opportunities/${opportunityId}`)
    assert.equal(forwarded.options.method, 'PATCH')
    assert.equal(forwarded.options.body, body)
    assert.equal(forwarded.options.headers['x-arsy-operator-token'], token)
    assert.equal((await response.json()).data.version, 3)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('authenticated opportunity DELETE archives without forwarding a body', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let forwarded
  globalThis.fetch = async (url, options) => {
    forwarded = { url: String(url), options }
    return new Response(null, { status: 204 })
  }
  try {
    const response = await DELETE(new Request(`${origin}/api/opportunities/${opportunityId}`, {
      method: 'DELETE',
      headers: { origin, cookie: sessionCookie() },
    }), context())
    assert.equal(response.status, 204)
    assert.equal(forwarded.url, `https://arsy.internal/api/v1/opportunities/${opportunityId}`)
    assert.equal(forwarded.options.method, 'DELETE')
    assert.equal('body' in forwarded.options, false)
    assert.equal(forwarded.options.headers['x-arsy-operator-token'], token)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
