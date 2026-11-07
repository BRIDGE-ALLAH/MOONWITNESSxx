import test from 'node:test'
import assert from 'node:assert/strict'
import { GET as getOpportunity, PATCH as editOpportunity, DELETE as archiveOpportunity } from '../src/app/api/opportunities/[id]/route.ts'
import { PATCH as updateDecision } from '../src/app/api/opportunities/[id]/decision/route.ts'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const token = 'test-only-arsy-service-token'
const operatorId = 'operator-test'
const origin = 'https://hq.example'
const id = '9c4a1ef2-3b7d-4e5f-8a91-0b2c3d4e5f67'

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

const context = (value = id) => ({ params: Promise.resolve({ id: value }) })

test('opportunity detail proxy validates UUIDs and forwards authenticated reads', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let upstreamUrl = ''
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    assert.equal(options.method, 'GET')
    return new Response(JSON.stringify({ data: { id } }), { status: 200 })
  }
  try {
    const invalid = await getOpportunity(new Request(`${origin}/api/opportunities/not-a-uuid`), context('not-a-uuid'))
    assert.equal(invalid.status, 400)
    const response = await getOpportunity(new Request(`${origin}/api/opportunities/${id}`, {
      headers: { cookie: sessionCookie() },
    }), context())
    assert.equal(response.status, 200)
    assert.equal(upstreamUrl, `https://arsy.internal/api/v1/opportunities/${id}`)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('opportunity decision proxy forwards authenticated same-origin PATCH', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let upstreamUrl = ''
  let upstreamBody = ''
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    upstreamBody = options.body
    assert.equal(options.method, 'PATCH')
    return new Response(JSON.stringify({ data: { id, decision: 'research-more' } }), { status: 200 })
  }
  try {
    const body = JSON.stringify({ decision: 'research-more', rationale: 'Evidence needs one more independent source.' })
    const response = await updateDecision(new Request(`${origin}/api/opportunities/${id}/decision`, {
      method: 'PATCH',
      headers: { origin, cookie: sessionCookie(), 'content-type': 'application/json' },
      body,
    }), context())
    assert.equal(response.status, 200)
    assert.equal(upstreamUrl, `https://arsy.internal/api/v1/opportunities/${id}/decision`)
    assert.equal(upstreamBody, body)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('opportunity archive proxy forwards authenticated same-origin DELETE without a body', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let upstreamUrl = ''
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    assert.equal(options.method, 'DELETE')
    assert.equal(options.body, undefined)
    assert.equal(options.headers['content-type'], undefined)
    return new Response(null, { status: 204 })
  }
  try {
    const response = await archiveOpportunity(new Request(`${origin}/api/opportunities/${id}`, {
      method: 'DELETE',
      headers: { origin, cookie: sessionCookie() },
    }), context())
    assert.equal(response.status, 204)
    assert.equal(upstreamUrl, `https://arsy.internal/api/v1/opportunities/${id}`)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})

test('opportunity archive proxy rejects anonymous callers before contacting ARSY', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => { fetchCalled = true; throw new Error('unexpected upstream request') }
  try {
    const response = await archiveOpportunity(new Request(`${origin}/api/opportunities/${id}`, {
      method: 'DELETE',
      headers: { origin },
    }), context())
    assert.equal(response.status, 401)
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})


test('opportunity content PATCH proxy requires an operator session and trusted origin', async () => {
  const restore = configureEnvironment()
  const originalFetch = globalThis.fetch
  let upstreamUrl = ''
  let upstreamBody = ''
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url)
    upstreamBody = options.body
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers['x-arsy-operator-token'], token)
    return new Response(JSON.stringify({ data: { id, revision: 2 } }), { status: 200 })
  }
  try {
    const body = JSON.stringify({ expectedRevision: 1, input: { title: 'Updated opportunity' } })
    const anonymous = await editOpportunity(new Request(origin + '/api/opportunities/' + id, {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json' },
      body,
    }), context())
    assert.equal(anonymous.status, 401)

    const badOrigin = await editOpportunity(new Request(origin + '/api/opportunities/' + id, {
      method: 'PATCH',
      headers: { origin: 'https://attacker.example', cookie: sessionCookie(), 'content-type': 'application/json' },
      body,
    }), context())
    assert.equal(badOrigin.status, 403)

    const response = await editOpportunity(new Request(origin + '/api/opportunities/' + id, {
      method: 'PATCH',
      headers: { origin, cookie: sessionCookie(), 'content-type': 'application/json' },
      body,
    }), context())
    assert.equal(response.status, 200)
    assert.equal(upstreamUrl, 'https://arsy.internal/api/v1/opportunities/' + id)
    assert.equal(upstreamBody, body)
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
