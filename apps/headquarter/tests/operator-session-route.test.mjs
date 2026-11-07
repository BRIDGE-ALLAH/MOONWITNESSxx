import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { DELETE, GET, POST } from '../src/app/api/auth/session/route.ts'
import { resolveLoginNetworkHash } from '../src/lib/shared-login-limit.ts'
import { OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const password = 'test-only-operator-password'
const origin = 'https://hq.example'
const operatorId = 'operator-test'
const originalFetch = globalThis.fetch

function configureEnvironment(overrides = {}) {
  const values = {
    NODE_ENV: 'test',
    ARSY_OPERATOR_ID: operatorId,
    ARSY_OPERATOR_TOKEN: 'test-arsy-token',
    ARSY_API_BASE_URL: 'http://arsy.test',
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: origin,
    HEADQUARTER_TRUSTED_PROXY_HOPS: '0',
    ...overrides,
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  return () => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    globalThis.fetch = originalFetch
  }
}

function mockLimiter(handler) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    const call = {
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')),
      headers: new Headers(init?.headers),
      signal: init?.signal,
      cache: init?.cache,
      redirect: init?.redirect,
    }
    calls.push(call)
    return new Response(JSON.stringify({ data: handler(call.body.action, calls.length) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return calls
}

test('operator login fails closed when session configuration is missing', async () => {
  const restore = configureEnvironment()
  delete process.env.HEADQUARTER_OPERATOR_PASSWORD
  try {
    const response = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 503)
  } finally {
    restore()
  }
})

test('operator login rejects cross-origin requests before contacting shared throttle', async () => {
  const restore = configureEnvironment()
  try {
    const calls = mockLimiter(() => ({ allowed: true, retryAfterSeconds: 0 }))
    const response = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 403)
    assert.equal(calls.length, 0)
  } finally {
    restore()
  }
})

test('operator login issues an HttpOnly strict cookie only after shared throttle approval', async () => {
  const restore = configureEnvironment()
  try {
    const calls = mockLimiter(() => ({ allowed: true, retryAfterSeconds: 0 }))
    const login = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }))
    assert.equal(login.status, 200)
    assert.deepEqual(calls.map((call) => call.body.action), ['check', 'success'])
    assert.ok(calls.every((call) => call.url === 'http://arsy.test/api/v1/auth/login-attempts'))
    assert.ok(calls.every((call) => call.headers.get('x-arsy-operator-token') === 'test-arsy-token'))
    assert.ok(calls.every((call) => /^[a-f0-9]{64}$/.test(call.body.networkHash)))
    assert.ok(calls.every((call) => call.cache === 'no-store' && call.redirect === 'error'))
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

test('repeated invalid credentials use shared account and network buckets', async () => {
  const restore = configureEnvironment()
  try {
    let failures = 0
    const calls = mockLimiter((action) => {
      if (action === 'check') {
        return { allowed: failures < 5, retryAfterSeconds: failures < 5 ? 0 : 900 }
      }
      if (action === 'failure') {
        failures += 1
        return { allowed: failures < 5, retryAfterSeconds: failures < 5 ? 0 : 900 }
      }
      return { allowed: true, retryAfterSeconds: 0 }
    })
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
    assert.equal(limited.headers.get('retry-after'), '900')
    assert.equal((await attempt()).status, 429)
    assert.equal(calls.filter((call) => call.body.action === 'failure').length, 5)
  } finally {
    restore()
  }
})

test('login fails closed when shared PostgreSQL throttle is unavailable', async () => {
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

test('network identity ignores spoofed forwarded headers unless one trusted hop is configured', () => {
  const spoofed = new Request(`${origin}/api/auth/session`, {
    headers: { 'x-forwarded-for': '203.0.113.99' },
  })
  const local = resolveLoginNetworkHash(spoofed, {
    NODE_ENV: 'test',
    HEADQUARTER_SESSION_SECRET: secret,
  })
  const expectedLocal = createHmac('sha256', secret)
    .update('moonwitness-login-network-v1:')
    .update('local-development-network')
    .digest('hex')
  assert.equal(local, expectedLocal)

  assert.equal(resolveLoginNetworkHash(spoofed, {
    NODE_ENV: 'production',
    HEADQUARTER_SESSION_SECRET: secret,
  }), null)

  const trusted = resolveLoginNetworkHash(spoofed, {
    NODE_ENV: 'production',
    HEADQUARTER_TRUSTED_PROXY_HOPS: '1',
    HEADQUARTER_SESSION_SECRET: secret,
  })
  assert.equal(
    trusted,
    createHmac('sha256', secret).update('moonwitness-login-network-v1:203.0.113.99').digest('hex'),
  )

  for (const forwarded of ['bad-ip, 203.0.113.99', 'not-an-ip']) {
    const request = new Request(`${origin}/api/auth/session`, {
      headers: { 'x-forwarded-for': forwarded },
    })
    assert.equal(resolveLoginNetworkHash(request, {
      NODE_ENV: 'production',
      HEADQUARTER_TRUSTED_PROXY_HOPS: '1',
      HEADQUARTER_SESSION_SECRET: secret,
    }), null)
  }
})
