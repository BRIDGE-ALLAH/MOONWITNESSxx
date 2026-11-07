import test from 'node:test'
import assert from 'node:assert/strict'
import { DELETE, GET, POST } from '../src/app/api/auth/session/route.ts'
import { OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const password = 'test-only-operator-password'
const origin = 'https://hq.example'
const operatorId = 'operator-test'

function configureEnvironment() {
  const values = {
    ARSY_OPERATOR_ID: operatorId,
    ARSY_OPERATOR_TOKEN: 'test-arsy-service-token',
    ARSY_API_BASE_URL: 'http://arsy.internal:3001',
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: origin,
    HEADQUARTER_TRUSTED_PROXY_HOPS: '0',
  }
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  return () => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function installSharedLimiter() {
  const previous = globalThis.fetch
  const buckets = new Map()
  globalThis.fetch = async (input, init = {}) => {
    const operation = new URL(String(input)).pathname.split('/').at(-1)
    const keys = JSON.parse(String(init.body))
    const bucketKeys = [`operator:${keys.operatorBucketHash}`, `network:${keys.networkBucketHash}`]
    const now = Date.now()
    const retryAfter = () => Math.max(0, ...bucketKeys.map((key) => Math.ceil(((buckets.get(key)?.blockedUntil ?? 0) - now) / 1000)))
    if (operation === 'check') return new Response(JSON.stringify({ data: { retryAfterSeconds: retryAfter() } }), { status: 200 })
    if (operation === 'failure') {
      for (const key of bucketKeys) {
        const current = buckets.get(key) ?? { count: 0, startedAt: now, blockedUntil: 0 }
        if (current.startedAt <= now - 15 * 60 * 1000 || (current.blockedUntil && current.blockedUntil <= now)) {
          current.count = 0; current.startedAt = now; current.blockedUntil = 0
        }
        current.count += 1
        if (current.count >= 5) current.blockedUntil = now + 15 * 60 * 1000
        buckets.set(key, current)
      }
      return new Response(JSON.stringify({ data: { retryAfterSeconds: retryAfter() } }), { status: 200 })
    }
    if (operation === 'success') {
      for (const key of bucketKeys) buckets.delete(key)
      return new Response(JSON.stringify({ data: { cleared: true } }), { status: 200 })
    }
    return new Response('', { status: 404 })
  }
  return () => { globalThis.fetch = previous }
}

test('operator login fails closed when session configuration is missing', async () => {
  const keys = ['HEADQUARTER_OPERATOR_PASSWORD', 'HEADQUARTER_SESSION_SECRET', 'HEADQUARTER_PUBLIC_ORIGIN']
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
  const restoreFetch = installSharedLimiter()
  try {
    const crossOrigin = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ password }),
    }))
    const invalidPassword = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'incorrect' }),
    }))
    assert.equal(crossOrigin.status, 403)
    assert.equal(invalidPassword.status, 401)
    assert.deepEqual(await invalidPassword.json(), { error: { code: 'INVALID_CREDENTIALS' } })
  } finally {
    restoreFetch(); restore()
  }
})

test('operator login issues an HttpOnly strict cookie that authenticates and can be revoked', async () => {
  const restore = configureEnvironment()
  const restoreFetch = installSharedLimiter()
  try {
    const login = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password }),
    }))
    assert.equal(login.status, 200)
    const cookie = login.cookies.get(OPERATOR_SESSION_COOKIE)
    assert.ok(cookie?.value)
    assert.equal(cookie.httpOnly, true)
    assert.equal(cookie.sameSite, 'strict')

    const session = await GET(new Request(`${origin}/api/auth/session`, { headers: { cookie: `${OPERATOR_SESSION_COOKIE}=${cookie.value}` } }))
    assert.equal(session.status, 200)
    assert.equal((await session.json()).data.operatorId, operatorId)

    const logout = await DELETE(new Request(`${origin}/api/auth/session`, {
      method: 'DELETE', headers: { origin, cookie: `${OPERATOR_SESSION_COOKIE}=${cookie.value}` },
    }))
    assert.equal(logout.status, 200)
    assert.equal(logout.cookies.get(OPERATOR_SESSION_COOKIE)?.value, '')
  } finally {
    restoreFetch(); restore()
  }
})

test('operator login rate-limits repeated invalid credentials through the shared limiter contract', async () => {
  const restore = configureEnvironment()
  const restoreFetch = installSharedLimiter()
  try {
    const attempt = () => POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'incorrect-password' }),
    }))
    for (let index = 0; index < 4; index += 1) assert.equal((await attempt()).status, 401)
    const limited = await attempt()
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('retry-after')) > 0)
    assert.equal((await attempt()).status, 429)
  } finally {
    restoreFetch(); restore()
  }
})

test('untrusted forwarded headers are ignored in local mode and cannot create a new network bucket', async () => {
  const restore = configureEnvironment()
  const restoreFetch = installSharedLimiter()
  try {
    const first = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.10' }, body: JSON.stringify({ password: 'wrong-password' }),
    }))
    const second = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.99' }, body: JSON.stringify({ password: 'wrong-password' }),
    }))
    assert.equal(first.status, 401)
    assert.equal(second.status, 401)
  } finally {
    restoreFetch(); restore()
  }
})

test('login fails closed when the shared limiter service is unavailable', async () => {
  const restore = configureEnvironment()
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('ARSY unavailable') }
  try {
    const response = await POST(new Request(`${origin}/api/auth/session`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, 'LOGIN_PROTECTION_UNAVAILABLE')
  } finally {
    globalThis.fetch = previous
    restore()
  }
})
