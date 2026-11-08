import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  getDockerInfo,
  getDockerContainerLogs,
  getDockerContainerStats,
  listDockerContainers,
} from '../src/docker/engine.ts'
import {
  decryptDockerCredentials,
  encryptDockerCredentials,
  resolveRemoteDockerEndpoint,
  validateRemoteDockerEndpoint,
  validateTlsCredentials,
} from '../src/docker/security.ts'
import { createApp } from '../src/app.ts'

const key = Buffer.alloc(32, 7).toString('base64')
const env = {
  DOCKER_CREDENTIALS_ENCRYPTION_KEY: key,
  DOCKER_REMOTE_ALLOWED_HOSTS: 'docker.example.com',
}

test('Docker container telemetry parses a single sample and computes cgroup-aware metrics', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mw-docker-stats-'))
  const socketPath = path.join(directory, 'docker.sock')
  const responseBody = {
    read: '2026-11-08T07:00:00.000Z',
    cpu_stats: {
      cpu_usage: { total_usage: 500, percpu_usage: [250, 250] },
      system_cpu_usage: 1000,
      online_cpus: 0,
    },
    precpu_stats: {
      cpu_usage: { total_usage: 400, percpu_usage: [200, 200] },
      system_cpu_usage: 800,
      online_cpus: 0,
    },
    memory_stats: { usage: 200, limit: 1000, stats: { inactive_file: 40 } },
    pids_stats: { current: 3 },
    networks: { eth0: { rx_bytes: 10, tx_bytes: 20 }, eth1: { rx_bytes: 3, tx_bytes: 4 } },
    blkio_stats: {
      io_service_bytes_recursive: [
        { op: 'Read', value: 100 },
        { op: 'Write', value: 20 },
        { op: 'Sync', value: 5 },
      ],
    },
  }
  const server = createServer((request, response) => {
    assert.equal(request.method, 'GET')
    assert.equal(request.url, '/containers/abcdef012345/stats?stream=false&one-shot=true')
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(responseBody))
  })
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(socketPath, resolve)
    })
    const stats = await getDockerContainerStats({ kind: 'local', socketPath }, 'abcdef012345')
    assert.equal(stats.observedAt, '2026-11-08T07:00:00.000Z')
    assert.equal(stats.cpuPercent, 100)
    assert.equal(stats.memoryUsageBytes, 160)
    assert.equal(stats.memoryLimitBytes, 1000)
    assert.equal(stats.memoryPercent, 16)
    assert.equal(stats.pids, 3)
    assert.equal(stats.networkRxBytes, 13)
    assert.equal(stats.networkTxBytes, 24)
    assert.equal(stats.blockReadBytes, 100)
    assert.equal(stats.blockWriteBytes, 20)
    await assert.rejects(
      getDockerContainerStats({ kind: 'local', socketPath }, 'not-a-container'),
      /Invalid Docker container identifier/
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})

test('Docker runtime stats API validates resource ownership before contacting an Engine', async () => {
  const operatorId = 'telemetry-test-operator'
  const token = 'telemetry-test-token-with-at-least-32-characters'
  const serverId = 'a3e48f3c-98bb-4e19-8bb2-1d92f1d99f20'
  const queries = []
  const pool = {
    query: async (statement, values = []) => {
      queries.push({ statement, values })
      return { rows: [] }
    },
    end: async () => undefined,
  }
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const invalid = await app.inject({
      url: `/api/v1/infrastructure/docker/servers/${serverId}/containers/not-a-container/stats`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal(queries.length, 0)

    const missing = await app.inject({
      url: `/api/v1/infrastructure/docker/servers/${serverId}/containers/abcdef012345/stats`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(missing.statusCode, 404)
    assert.match(queries[0].statement, /WHERE id = \$1 AND owner_id = \$2/)
    assert.deepEqual(queries[0].values, [serverId, operatorId])
  } finally {
    await app.close()
  }
})

test('remote endpoint validation requires HTTPS and an explicit exact host allowlist', () => {
  assert.equal(
    validateRemoteDockerEndpoint('https://docker.example.com:2376', env).hostname,
    'docker.example.com'
  )
  for (const value of [
    'http://docker.example.com:2376',
    'https://user:pass@docker.example.com:2376',
    'https://127.0.0.1:2376',
    'https://localhost:2376',
    'https://not-allowed.example.com:2376',
    'https://docker.example.com/private',
    'https://docker.example.com:4444',
  ])
    assert.throws(() => validateRemoteDockerEndpoint(value, env))
})

test('remote endpoint DNS resolution blocks unsafe targets and returns pinned addresses', async () => {
  const publicAddress = { address: '93.184.216.34', family: 4 }
  const resolved = await resolveRemoteDockerEndpoint(
    'https://docker.example.com:2376',
    env,
    async () => [publicAddress]
  )
  assert.equal(resolved.url.origin, 'https://docker.example.com:2376')
  assert.deepEqual(resolved.addresses, [publicAddress])

  await assert.rejects(
    resolveRemoteDockerEndpoint('https://docker.example.com:2376', env, async () => [
      { address: '127.0.0.1', family: 4 },
    ]),
    /blocked address/
  )

  await assert.rejects(
    resolveRemoteDockerEndpoint('https://docker.example.com:2376', env, async () => [
      { address: '10.20.30.40', family: 4 },
    ]),
    /private address/
  )

  const privateAllowed = await resolveRemoteDockerEndpoint(
    'https://docker.example.com:2376',
    { ...env, DOCKER_REMOTE_ALLOW_PRIVATE_NETWORKS: '1' },
    async () => [{ address: '10.20.30.40', family: 4 }]
  )
  assert.deepEqual(privateAllowed.addresses, [{ address: '10.20.30.40', family: 4 }])
})

test('remote Docker TLS credentials are authenticated-encrypted and never returned as plaintext', () => {
  const credentials = { ca: 'ca-pem', cert: 'client-cert', key: 'private-key' }
  const encrypted = encryptDockerCredentials(credentials, env)
  assert.equal(encrypted.includes('private-key'), false)
  assert.deepEqual(decryptDockerCredentials(encrypted, env), credentials)
  assert.throws(() =>
    decryptDockerCredentials(encrypted, {
      ...env,
      DOCKER_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
    })
  )
  assert.throws(() => encryptDockerCredentials(credentials, {}), /not configured/)
})

test('TLS credentials require all three bounded PEM strings', () => {
  assert.deepEqual(validateTlsCredentials({ ca: 'ca', cert: 'cert', key: 'key' }), {
    ca: 'ca',
    cert: 'cert',
    key: 'key',
  })
  assert.throws(() => validateTlsCredentials({ ca: 'ca', cert: '', key: 'key' }))
})

test(
  'Docker Engine adapter reads only info and a bounded container inventory over a Unix socket',
  {
    skip:
      process.platform === 'win32' &&
      'Windows does not support Unix domain sockets at arbitrary temp paths',
  },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'mw-docker-'))
    const socketPath = path.join(directory, 'docker.sock')
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json')
      if (request.url === '/info') {
        response.end(JSON.stringify({ Name: 'fixture-engine', ServerVersion: '27.0.0', NCPU: 2 }))
        return
      }
      if (request.url === '/containers/abcdef012345/logs?stdout=1&stderr=1&tail=200&timestamps=1') {
        const frame = (stream, value) => {
          const payload = Buffer.from(value)
          const header = Buffer.alloc(8)
          header[0] = stream
          header.writeUInt32BE(payload.length, 4)
          return Buffer.concat([header, payload])
        }
        response.end(Buffer.concat([frame(1, 'stdout line\n'), frame(2, 'stderr line\n')]))
        return
      }
      if (request.url === '/containers/json?all=1&limit=100') {
        response.end(
          JSON.stringify(
            Array.from({ length: 110 }, (_, index) => ({
              Id: `container-${index}`,
              Names: [`/fixture-${index}`],
              Image: 'fixture:latest',
              State: 'running',
              Status: 'Up 1 minute',
              Created: 1,
            }))
          )
        )
        return
      }
      response.statusCode = 404
      response.end('{}')
    })
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(socketPath, resolve)
      })
      const connection = { kind: 'local', socketPath }
      assert.equal((await getDockerInfo(connection)).ServerVersion, '27.0.0')
      const containers = await listDockerContainers(connection)
      assert.equal(containers.length, 100)
      assert.equal(containers[0].names[0], '/fixture-0')
    } finally {
      await new Promise((resolve) => server.close(resolve))
      await rm(directory, { recursive: true, force: true })
    }
  }
)

test('Docker connector API fails closed when operator identity or token is missing', async () => {
  const pool = { query: async () => ({ rows: [] }), end: async () => undefined }
  const app = createApp({ databasePool: pool, logger: false, env: {} })
  try {
    const response = await app.inject('/api/v1/infrastructure/docker/servers')
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})

test('Docker connector API rejects anonymous callers before database access', async () => {
  let queries = 0
  const pool = {
    query: async () => {
      queries += 1
      return { rows: [] }
    },
    end: async () => undefined,
  }
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'operator-1', ARSY_OPERATOR_TOKEN: 'secret-token' },
  })
  try {
    const response = await app.inject('/api/v1/infrastructure/docker/servers')
    assert.equal(response.statusCode, 401)
    assert.equal(queries, 0)
  } finally {
    await app.close()
  }
})

test(
  'ARSY connects to a real local Docker Engine and reads info plus container inventory',
  {
    skip:
      process.env.DOCKER_SMOKE_SOCKET !== '1' &&
      'Set DOCKER_SMOKE_SOCKET=1 only in a controlled Docker-enabled test runner',
  },
  async () => {
    const socketPath = process.env.DOCKER_LOCAL_SOCKET_PATH || '/var/run/docker.sock'
    const operatorToken = 'docker-smoke-test-token'
    const operatorId = 'docker-smoke-test-owner'
    const serverRow = {
      id: 'a3e48f3c-98bb-4e19-8bb2-1d92f1d99f20',
      name: 'CI Docker Engine',
      kind: 'local',
      endpoint_url: null,
      encrypted_credentials: null,
      created_at: new Date().toISOString(),
    }
    const pool = {
      query: async (statement) => {
        if (statement.includes('WITH inserted AS')) return { rows: [serverRow] }
        if (statement.includes('FROM docker_connector_servers')) return { rows: [serverRow] }
        return { rows: [] }
      },
      end: async () => undefined,
    }
    const app = createApp({
      databasePool: pool,
      logger: false,
      env: {
        ARSY_OPERATOR_ID: operatorId,
        ARSY_OPERATOR_TOKEN: operatorToken,
        DOCKER_LOCAL_SOCKET_PATH: socketPath,
      },
    })
    const headers = { 'x-arsy-operator-token': operatorToken }
    try {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/v1/infrastructure/docker/servers',
        headers,
        payload: { name: serverRow.name, kind: 'local' },
      })
      assert.equal(registered.statusCode, 201, registered.body)
      const info = await app.inject({
        method: 'GET',
        url: `/api/v1/infrastructure/docker/servers/${serverRow.id}/info`,
        headers,
      })
      assert.equal(info.statusCode, 200, info.body)
      assert.ok(info.json().data.engine.serverVersion)
      const inventory = await app.inject({
        method: 'GET',
        url: `/api/v1/infrastructure/docker/servers/${serverRow.id}/containers`,
        headers,
      })
      assert.equal(inventory.statusCode, 200, inventory.body)
      assert.ok(Array.isArray(inventory.json().data.containers))
      assert.ok(inventory.json().data.containers.length <= 100)
    } finally {
      await app.close()
    }
  }
)

test(
  'remote Docker Engine requires a valid mutually authenticated TLS session',
  {
    skip:
      process.env.DOCKER_MTLS_SMOKE !== '1' &&
      'Set DOCKER_MTLS_SMOKE=1 only in the isolated TLS integration runner',
  },
  async () => {
    const https = await import('node:https')
    const directory = await mkdtemp(path.join(tmpdir(), 'mw-docker-mtls-'))
    const file = (name) => path.join(directory, name)
    const runOpenSsl = (...args) => execFileSync('openssl', args, { stdio: 'ignore' })
    try {
      runOpenSsl(
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        file('ca.key'),
        '-out',
        file('ca.crt'),
        '-days',
        '1',
        '-subj',
        '/CN=MOONWITNESS Test CA'
      )
      runOpenSsl(
        'req',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        file('server.key'),
        '-out',
        file('server.csr'),
        '-subj',
        '/CN=docker.example.com'
      )
      await writeFile(
        file('server.ext'),
        'subjectAltName=DNS:docker.example.com\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n'
      )
      runOpenSsl(
        'x509',
        '-req',
        '-in',
        file('server.csr'),
        '-CA',
        file('ca.crt'),
        '-CAkey',
        file('ca.key'),
        '-CAcreateserial',
        '-out',
        file('server.crt'),
        '-days',
        '1',
        '-extfile',
        file('server.ext')
      )
      runOpenSsl(
        'req',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        file('client.key'),
        '-out',
        file('client.csr'),
        '-subj',
        '/CN=MOONWITNESS Test Client'
      )
      await writeFile(
        file('client.ext'),
        'extendedKeyUsage=clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n'
      )
      runOpenSsl(
        'x509',
        '-req',
        '-in',
        file('client.csr'),
        '-CA',
        file('ca.crt'),
        '-CAkey',
        file('ca.key'),
        '-CAcreateserial',
        '-out',
        file('client.crt'),
        '-days',
        '1',
        '-extfile',
        file('client.ext')
      )

      const [ca, serverCert, serverKey, clientCert, clientKey] = await Promise.all([
        readFile(file('ca.crt'), 'utf8'),
        readFile(file('server.crt'), 'utf8'),
        readFile(file('server.key'), 'utf8'),
        readFile(file('client.crt'), 'utf8'),
        readFile(file('client.key'), 'utf8'),
      ])
      let acceptedClientCertificate = false
      const server = https.createServer(
        {
          key: serverKey,
          cert: serverCert,
          ca,
          requestCert: true,
          rejectUnauthorized: true,
        },
        (request, response) => {
          acceptedClientCertificate = request.socket.authorized === true
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify({ Name: 'mtls-fixture-engine', ServerVersion: '27.0.0' }))
        }
      )
      try {
        await new Promise((resolve, reject) => {
          server.once('error', reject)
          server.listen(2376, '0.0.0.0', resolve)
        })
        const info = await getDockerInfo({
          kind: 'remote',
          endpointUrl: 'https://docker.example.com:2376',
          addresses: [{ address: '127.0.0.1', family: 4 }],
          tls: { ca, cert: clientCert, key: clientKey },
        })
        assert.equal(info.Name, 'mtls-fixture-engine')
        assert.equal(info.ServerVersion, '27.0.0')
        assert.equal(acceptedClientCertificate, true)
        await assert.rejects(
          getDockerInfo({
            kind: 'remote',
            endpointUrl: 'https://docker.example.com:2376',
            addresses: [{ address: '127.0.0.1', family: 4 }],
            tls: { ca, cert: '', key: '' },
          })
        )
      } finally {
        await new Promise((resolve) => server.close(resolve))
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
)

test(
  'Docker container logs decode bounded multiplexed stdout and stderr frames',
  {
    skip:
      process.platform === 'win32' &&
      'Windows does not support Unix domain sockets at arbitrary temp paths',
  },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'mw-docker-logs-'))
    const socketPath = path.join(directory, 'docker.sock')
    const server = createServer((request, response) => {
      if (request.url !== '/containers/abcdef012345/logs?stdout=1&stderr=1&tail=200&timestamps=1') {
        response.statusCode = 404
        response.end()
        return
      }
      const frame = (stream, value) => {
        const payload = Buffer.from(value)
        const header = Buffer.alloc(8)
        header[0] = stream
        header.writeUInt32BE(payload.length, 4)
        return Buffer.concat([header, payload])
      }
      response.end(Buffer.concat([frame(1, 'stdout line\n'), frame(2, 'stderr line\n')]))
    })
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(socketPath, resolve)
      })
      const logs = await getDockerContainerLogs({ kind: 'local', socketPath }, 'abcdef012345')
      assert.deepEqual(logs, { stdout: 'stdout line\n', stderr: 'stderr line\n' })
      await assert.rejects(
        getDockerContainerLogs({ kind: 'local', socketPath }, 'not-a-container-id'),
        /Invalid Docker container identifier/
      )
    } finally {
      await new Promise((resolve) => server.close(resolve))
      await rm(directory, { recursive: true, force: true })
    }
  }
)

test('ARSY rejects malformed server identifiers before database access', async () => {
  let queries = 0
  const pool = {
    query: async () => {
      queries += 1
      return { rows: [] }
    },
    end: async () => undefined,
  }
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'operator-1', ARSY_OPERATOR_TOKEN: 'secret-token' },
  })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/infrastructure/docker/servers/not-a-uuid/info',
      headers: { 'x-arsy-operator-token': 'secret-token' },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'INVALID_SERVER_ID')
    assert.equal(queries, 0)
  } finally {
    await app.close()
  }
})

test('Docker server inventory never serializes encrypted TLS credential material', async () => {
  const secretCiphertext = 'sensitive-encrypted-credential-payload'
  const pool = {
    query: async () => ({
      rows: [
        {
          id: 'a3e48f3c-98bb-4e19-8bb2-1d92f1d99f20',
          name: 'Remote fixture',
          kind: 'remote',
          endpoint_url: 'https://docker.example.com:2376',
          encrypted_credentials: secretCiphertext,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    end: async () => undefined,
  }
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'operator-1', ARSY_OPERATOR_TOKEN: 'secret-token' },
  })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/infrastructure/docker/servers',
      headers: { 'x-arsy-operator-token': 'secret-token' },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.includes(secretCiphertext), false)
    assert.equal(response.json().data[0].encrypted_credentials, undefined)
  } finally {
    await app.close()
  }
})

test('IPv6 endpoint resolution rejects special-use and non-global addresses by default', async () => {
  const blocked = [
    '::',
    '::1',
    'fe80::1',
    'ff02::1',
    '2001:0::1',
    '2001:2::1',
    '2001:1ff::1',
    '2001:db8::1',
    '2002::1',
    '3fff::1',
  ]

  for (const address of blocked) {
    await assert.rejects(
      resolveRemoteDockerEndpoint('https://docker.example.com:2376', env, async () => [
        { address, family: 6 },
      ]),
      /blocked address/,
      address + ' must be rejected as a non-global or special-purpose destination'
    )
  }

  await assert.rejects(
    resolveRemoteDockerEndpoint('https://docker.example.com:2376', env, async () => [
      { address: 'fc00::1', family: 6 },
    ]),
    /private address/,
    'IPv6 unique-local space must require explicit private-network opt-in'
  )

  const publicAddress = { address: '2606:4700:4700::1111', family: 6 }
  const resolved = await resolveRemoteDockerEndpoint(
    'https://docker.example.com:2376',
    env,
    async () => [publicAddress]
  )
  assert.deepEqual(resolved.addresses, [publicAddress])

  const privateAllowed = await resolveRemoteDockerEndpoint(
    'https://docker.example.com:2376',
    { ...env, DOCKER_REMOTE_ALLOW_PRIVATE_NETWORKS: '1' },
    async () => [{ address: 'fc00::1', family: 6 }]
  )
  assert.deepEqual(privateAllowed.addresses, [{ address: 'fc00::1', family: 6 }])
})
