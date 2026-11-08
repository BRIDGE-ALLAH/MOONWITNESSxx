import test from 'node:test'
import assert from 'node:assert/strict'
import { POST } from '../src/app/api/auth/session/route.ts'
import {
  createTrustedClientIpSignature,
  isSharedLoginLimitConfigured,
  resolveLoginNetworkHash,
} from '../src/lib/shared-login-limit.ts'

const operatorId = 'shared-login-operator'
const password = 'shared-login-test-password'
const sessionSecret = 'shared-login-session-secret-with-32-or-more-bytes'
const proxySecret = 'shared-login-proxy-secret-with-32-or-more-bytes'
const origin = 'https://hq.example'

function productionEnv() {
  return {
    NODE_ENV: 'production',
    ARSY_OPERATOR_ID: operatorId,
    ARSY_OPERATOR_TOKEN: 'shared-login-arsy-token-with-at-least-32-characters',
    ARSY_API_BASE_URL: 'http://arsy.internal:3001',
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: sessionSecret,
    HEADQUARTER_PUBLIC_ORIGIN: origin,
    HEADQUARTER_TRUSTED_PROXY_HOPS: '1',
    HEADQUARTER_TRUSTED_PROXY_SECRET: proxySecret,
  }
}

function signedIpHeaders(ip = '203.0.113.10') {
  return {
    origin,
    'content-type': 'application/json',
    'x-moonwitness-client-ip': ip,
    'x-moonwitness-client-ip-signature': createTrustedClientIpSignature(ip, proxySecret),
  }
}

function setEnvironment(values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  return () => {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function withFetch(mock) {
  const previous = globalThis.fetch
  globalThis.fetch = mock
  return () => {
    globalThis.fetch = previous
  }
}

function request(headers = signedIpHeaders(), bodyPassword = password) {
  return new Request(`${origin}/api/auth/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ password: bodyPassword }),
  })
}

test('development login network bucket ignores all client-supplied forwarding headers', () => {
  const env = {
    NODE_ENV: 'development',
    HEADQUARTER_SESSION_SECRET: sessionSecret,
    HEADQUARTER_TRUSTED_PROXY_HOPS: '1',
    HEADQUARTER_TRUSTED_PROXY_SECRET: proxySecret,
  }
  const first = new Request('http://localhost/api/auth/session', {
    headers: { 'x-forwarded-for': '198.51.100.1' },
  })
  const second = new Request('http://localhost/api/auth/session', {
    headers: { 'x-forwarded-for': '203.0.113.250', 'x-moonwitness-client-ip': '192.0.2.5' },
  })
  assert.equal(resolveLoginNetworkHash(first, env), resolveLoginNetworkHash(second, env))
  assert.equal(
    resolveLoginNetworkHash(first, env),
    resolveLoginNetworkHash(first, {
      ...env,
      HEADQUARTER_TRUSTED_PROXY_HOPS: '0',
    })
  )
})

test('production network identity requires a configured single proxy and valid signed client IP', () => {
  const env = productionEnv()
  const unsigned = new Request(`${origin}/api/auth/session`, {
    headers: { 'x-forwarded-for': '203.0.113.10' },
  })
  assert.equal(resolveLoginNetworkHash(unsigned, env), null)
  assert.equal(isSharedLoginLimitConfigured(unsigned, env), false)

  const wrongSignature = new Request(`${origin}/api/auth/session`, {
    headers: {
      'x-moonwitness-client-ip': '203.0.113.10',
      'x-moonwitness-client-ip-signature': 'a'.repeat(64),
    },
  })
  assert.equal(resolveLoginNetworkHash(wrongSignature, env), null)

  const trusted = new Request(`${origin}/api/auth/session`, {
    headers: signedIpHeaders('203.0.113.10'),
  })
  assert.match(resolveLoginNetworkHash(trusted, env), /^[a-f0-9]{64}$/)
  assert.equal(isSharedLoginLimitConfigured(trusted, env), true)

  const differentIp = new Request(`${origin}/api/auth/session`, {
    headers: signedIpHeaders('203.0.113.11'),
  })
  assert.notEqual(resolveLoginNetworkHash(trusted, env), resolveLoginNetworkHash(differentIp, env))

  assert.equal(
    resolveLoginNetworkHash(trusted, {
      ...env,
      HEADQUARTER_TRUSTED_PROXY_HOPS: '0',
    }),
    null
  )
})

test('trusted client IP signature rejects invalid addresses and weak secrets', () => {
  assert.throws(() => createTrustedClientIpSignature('not-an-ip', proxySecret), /valid IP/)
  assert.throws(() => createTrustedClientIpSignature('203.0.113.10', 'short'), /32-byte/)
})

test('production login reserves a shared attempt and clears the shared bucket after success', async () => {
  const restoreEnv = setEnvironment(productionEnv())
  const actions = []
  const restoreFetch = withFetch(async (_url, options) => {
    actions.push(JSON.parse(options.body).action)
    return new Response(JSON.stringify({ data: { allowed: true, retryAfterSeconds: 0 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  try {
    const response = await POST(request())
    assert.equal(response.status, 200)
    assert.deepEqual(actions, ['attempt', 'success'])
    assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/)
    assert.match(response.headers.get('set-cookie') ?? '', /SameSite=strict/i)
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

test('production login returns 429 before password verification when shared limit is exhausted', async () => {
  const restoreEnv = setEnvironment(productionEnv())
  const actions = []
  const restoreFetch = withFetch(async (_url, options) => {
    actions.push(JSON.parse(options.body).action)
    return new Response(JSON.stringify({ data: { allowed: false, retryAfterSeconds: 120 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  try {
    const response = await POST(request())
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('retry-after'), '120')
    assert.deepEqual(actions, ['attempt'])
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

test('production login fails closed when the shared limiter or trusted ingress is unavailable', async () => {
  const restoreEnv = setEnvironment(productionEnv())
  const restoreFetch = withFetch(async () => {
    throw new Error('internal connection details')
  })
  try {
    const response = await POST(request())
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, 'LOGIN_RATE_LIMIT_UNAVAILABLE')
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

test('production login fails closed on unsigned client-supplied forwarding headers', async () => {
  const restoreEnv = setEnvironment(productionEnv())
  let fetchCalled = false
  const restoreFetch = withFetch(async () => {
    fetchCalled = true
    return new Response(JSON.stringify({ data: { allowed: true, retryAfterSeconds: 0 } }), {
      status: 200,
    })
  })
  try {
    const response = await POST(
      request({
        origin,
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      })
    )
    assert.equal(response.status, 503)
    assert.equal(fetchCalled, false)
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

test('production login counts an invalid password exactly once in the shared limiter', async () => {
  const restoreEnv = setEnvironment(productionEnv())
  const actions = []
  const restoreFetch = withFetch(async (_url, options) => {
    actions.push(JSON.parse(options.body).action)
    return new Response(JSON.stringify({ data: { allowed: true, retryAfterSeconds: 0 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  try {
    const response = await POST(request(signedIpHeaders(), 'incorrect-password'))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'INVALID_CREDENTIALS')
    assert.deepEqual(actions, ['attempt'])
  } finally {
    restoreFetch()
    restoreEnv()
  }
})
