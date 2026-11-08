import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperatorSession, OPERATOR_SESSION_COOKIE } from '../src/lib/operator-session.ts'
import { GET as getDockerServers } from '../src/app/api/infrastructure/docker/servers/route.ts'
import { GET as getDockerInfo } from '../src/app/api/infrastructure/docker/servers/[id]/info/route.ts'
import { GET as getDockerLogs } from '../src/app/api/infrastructure/docker/servers/[id]/containers/[containerId]/logs/route.ts'

const ENV_KEYS = [
  'ARSY_OPERATOR_ID', 'ARSY_OPERATOR_TOKEN', 'ARSY_API_BASE_URL',
  'HEADQUARTER_OPERATOR_PASSWORD', 'HEADQUARTER_SESSION_SECRET', 'HEADQUARTER_PUBLIC_ORIGIN',
]

function configure() {
  process.env.ARSY_OPERATOR_ID = 'operator-test'
  process.env.ARSY_OPERATOR_TOKEN = 'server-only-test-token'
  process.env.ARSY_API_BASE_URL = 'http://arsy.internal:3001'
  process.env.HEADQUARTER_OPERATOR_PASSWORD = 'a-long-test-password'
  process.env.HEADQUARTER_SESSION_SECRET = '0123456789abcdef0123456789abcdef'
  process.env.HEADQUARTER_PUBLIC_ORIGIN = 'https://hq.example.com'
}

test('Docker Headquarter API proxy requires a valid operator session', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  try {
    configure()
    const response = await getDockerServers(new Request('https://hq.example.com/api/infrastructure/docker/servers'))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'UNAUTHENTICATED')
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('authenticated Docker proxy adds the server-only ARSY credential and never asks the browser for it', async () => {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  let capturedUrl = ''
  let capturedToken = ''
  try {
    configure()
    const session = createOperatorSession('operator-test', process.env.HEADQUARTER_SESSION_SECRET)
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input)
      capturedToken = new Headers(init?.headers).get('x-arsy-operator-token') || ''
      return Response.json({ data: { servers: [] } })
    }
    const request = new Request('https://hq.example.com/api/infrastructure/docker/servers', {
      headers: { cookie: `${OPERATOR_SESSION_COOKIE}=${session}` },
    })
    const response = await getDockerServers(request)
    assert.equal(response.status, 200)
    assert.equal(capturedUrl, 'http://arsy.internal:3001/api/v1/infrastructure/docker/servers')
    assert.equal(capturedToken, 'server-only-test-token')
    assert.deepEqual((await response.json()).data.servers, [])
  } finally {
    globalThis.fetch = originalFetch
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})

test('Docker Headquarter API validates server identifiers before proxying', async () => {
  const response = await getDockerInfo(new Request('https://hq.example.com/api/infrastructure/docker/servers/not-a-uuid/info'), {
    params: Promise.resolve({ id: 'not-a-uuid' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'INVALID_ID')
})

test('Docker Headquarter logs proxy rejects malformed container identifiers', async () => {
  const response = await getDockerLogs(new Request('https://hq.example.com/api/infrastructure/docker/servers/123e4567-e89b-12d3-a456-426614174000/containers/nope/logs'), {
    params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000', containerId: 'nope' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'INVALID_DOCKER_RESOURCE_ID')
})
