import test from 'node:test'
import assert from 'node:assert/strict'
import { DELETE, GET, POST } from '../src/app/api/auth/session/route.ts'
import { OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const password = 'test-only-operator-password'
const origin = 'https://hq.example'
const operatorId = 'operator-test'
const originalFetch = globalThis.fetch

function configureEnvironment() {
  const values = {
    ARSY_OPERATOR_ID: operatorId,
    ARSY_OPERATOR_TOKEN: 'test-only-arsy-service-token',
    ARSY_API_BASE_URL: 'http://127.0.0.1:3001',
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: origin,
    NODE_ENV: 'test',
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  return () => {
    globalThis.fetch = originalFetch
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function mockSharedLoginLimit() {
  let failures = 0
  const requests = []
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    requests.push(body.action)
    if (body.action === 'failure') failures += 1
    const allowed = body.action === 'check' ? failures < 5 : body.action === 'failure' ? failures < 5 : true
    return new Response(JSON.stringify({
      data: { allowed, retryAfterSeconds: allowed ? 0 : 900 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return requests
}

test('operator login fails closed when session configuration is missing', async () => {
  const keys = ['ARSY_OPERATOR_ID', 'ARSY_OPERATOR_TOKEN', 'ARSY_API_BASE_URL', 'HEADQUARTER_OPERATOR_PASSWORD', 'HEADQUARTER_SESSION_SECRET', 'HEADQUARTER_PUBLIC_ORIGIN']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  try {
    const response = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 503)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('operator login rejects cross-origin and incorrect-password requests', async () => {
  const restore = configureEnvironment()
  try {
    mockSharedLoginLimit()
    const crossOrigin = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    const invalidPassword = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'incorrect' }),
    }))
    assert.equal(crossOrigin.status, 403)
    assert.equal(invalidPassword.status, 401)
  } finally {
    restore()
  }
})

test('operator login issues an HttpOnly strict cookie that authenticates and can be revoked', async () => {
  const restore = configureEnvironment()
  try {
    mockSharedLoginLimit()
    const login = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(login.status, 200)
    const cookie = login.cookies.get(OPERATOR_SESSION_COOKIE)
    assert.ok(cookie?.value)
    assert.equal(cookie.httpOnly, true)
    assert.equal(cookie.sameSite, 'strict')

    const session = await GET(new Request(`${origin}/api/auth/session`, {
      headers: { cookie: `${OPERATOR_SESSION_COOKIE}=${cookie.value}` },
    }))
    assert.equal(session.status, 200)
    assert.equal((await session.json()).data.operatorId, operatorId)

    const logout = await DELETE(new Request(`${origin}/api/auth/session`, {
      method: 'DELETE',
      headers: { origin, cookie: `${OPERATOR_SESSION_COOKIE}=${cookie.value}` },
    }))
    assert.equal(logout.status, 200)
    assert.equal(logout.cookies.get(OPERATOR_SESSION_COOKIE)?.value, '')
  } finally {
    restore()
  }
})

test('operator login uses shared account and network buckets to rate-limit repeated failures', async () => {
  const restore = configureEnvironment()
  try {
    const requests = mockSharedLoginLimit()
    const attempt = () => POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'incorrect-password' }),
    }))
    for (let index = 0; index < 4; index += 1) {
      assert.equal((await attempt()).status, 401)
    }
    const limited = await attempt()
    assert.equal(limited.status, 429)
    assert.equal(Number(limited.headers.get('retry-after')), 900)
    assert.equal((await attempt()).status, 429)
    assert.equal(requests.filter((action) => action === 'failure').length, 5)
  } finally {
    restore()
  }
})

test('operator login fails closed when the shared throttle service is unavailable', async () => {
  const restore = configureEnvironment()
  try {
    globalThis.fetch = async () => { throw new Error('ARSY unavailable') }
    const response = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, 'LOGIN_RATE_LIMIT_UNAVAILABLE')
  } finally {
    restore()
  }
})
