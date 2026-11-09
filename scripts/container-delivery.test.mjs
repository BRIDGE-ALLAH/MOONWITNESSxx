import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFile(resolve(root, path), 'utf8')

test('ARSY and Headquarter use production-only workspace deployments and non-root Node runtimes', async () => {
  const cases = [
    {
      path: 'Dockerfile.arsy',
      packageName: '@riotworks/arsy',
      appPath: '/out/arsy/',
      command: /CMD\s+\["node",\s+"--experimental-transform-types",\s+"src\/index\.ts"\]/,
      port: '3001',
      healthPath: '/health/ready',
    },
    {
      path: 'Dockerfile.headquarter',
      packageName: '@riotworks/headquarter',
      appPath: '/out/headquarter/',
      command: /CMD\s+\["node",\s+"node_modules\/next\/dist\/bin\/next",\s+"start"/,
      port: '3000',
      healthPath: '/',
    },
  ]

  for (const item of cases) {
    const dockerfile = await read(item.path)
    assert.match(dockerfile, /FROM node:24\.22\.2-alpine3\.23 AS build/, item.path)
    assert.match(dockerfile, new RegExp('pnpm --filter ' + item.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' build'), item.path)
    assert.match(dockerfile, new RegExp('pnpm --filter ' + item.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' --prod deploy ' + item.appPath.replaceAll('/', '\\/')), item.path)
    assert.match(dockerfile, /FROM node:24\.22\.2-alpine3\.23 AS runtime/, item.path)
    assert.match(dockerfile, /COPY --from=build --chown=node:node/, item.path)
    assert.match(dockerfile, /ENV NODE_ENV=production/, item.path)
    assert.match(dockerfile, /USER node\s/, item.path)
    assert.match(dockerfile, new RegExp('PORT=' + item.port), item.path)
    assert.match(dockerfile, /HEALTHCHECK/, item.path)
    assert.match(dockerfile, item.command, item.path)
    assert.match(dockerfile, new RegExp(item.healthPath.replaceAll('/', '\\/')), item.path)
    assert.doesNotMatch(dockerfile, /pnpm\s+dev|USER root/, item.path)
  }
})

test('Docker build context excludes local secrets, Git metadata and generated dependency trees', async () => {
  const dockerignore = await read('.dockerignore')
  for (const pattern of ['.git', '.env', '.env.*', 'node_modules', '**/node_modules', '.next', '**/.next', 'target', '**/target', '*.pem', '*.key']) {
    assert.ok(dockerignore.includes(pattern), 'missing dockerignore rule: ' + pattern)
  }
})

test('container publication is limited to version tags or manual dispatch from main', async () => {
  const workflow = await read('.github/workflows/container-release.yml')
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /tags:\s*\n\s*-\s+"v\*"/)
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/)
  assert.doesNotMatch(workflow, /pull_request:/)
  assert.match(workflow, /packages:\s*write/)
  assert.match(workflow, /id-token:\s*write/)
  assert.match(workflow, /attestations:\s*write/)
})

test('published images are commit-addressed, scanned, and attested before version aliases', async () => {
  const workflow = await read('.github/workflows/container-release.yml')
  const buildStep = workflow.indexOf('Build and push commit-addressed candidate')
  const scanStep = workflow.indexOf('Reject high/critical vulnerabilities with available fixes')
  const aliasStep = workflow.indexOf('Add the immutable version alias only after scan and attestation pass')
  const attestStep = workflow.indexOf('Publish a GitHub artifact attestation for the pushed digest')

  assert.ok(buildStep >= 0 && scanStep > buildStep && attestStep > scanStep && aliasStep > attestStep)
  assert.match(workflow, /sha-\$\{GITHUB_SHA\}/)
  assert.match(workflow, /provenance:\s*mode=max/)
  assert.match(workflow, /sbom:\s*true/)
  assert.match(workflow, /aquasecurity\/trivy-action@v0\.36\.0/)
  assert.match(workflow, /severity:\s*HIGH,CRITICAL/)
  assert.match(workflow, /exit-code:\s*"1"/)
  assert.doesNotMatch(workflow, /:latest\b/)
  assert.match(workflow, /actions\/attest@v4\.2\.2/)
  assert.match(workflow, /subject-digest:/)
  assert.match(workflow, /push-to-registry:\s*true/)
  assert.match(workflow, /docker buildx imagetools create/)
})

test('pull-request container CI builds locally and verifies non-root runtime plus healthchecks', async () => {
  const ci = await read('.github/workflows/ci.yml')
  const start = ci.indexOf('  production-container-build:')
  assert.ok(start >= 0)
  const job = ci.slice(start)
  assert.match(job, /needs:\s*\n\s*- full-workspace-quality/)
  assert.match(job, /docker\/build-push-action@v7/)
  assert.match(job, /push:\s*false/)
  assert.match(job, /load:\s*true/)
  assert.match(job, /configured_user=.*Config\.User/)
  assert.match(job, /EXPECTED_USER/)
  assert.match(job, /nonroot:nonroot/)
  assert.match(job, /moonwitness-aegis/)
  assert.match(job, /RUNTIME_KIND/)
  assert.match(job, /process\.getuid\(\) === 0/)
  assert.match(job, /Config\.Healthcheck/)
  assert.match(job, /NODE_ENV=production/)
})


test('production image CI performs isolated ARSY migration and service health smoke tests', async () => {
  const ci = await read('.github/workflows/ci.yml')
  const start = ci.indexOf('  production-container-build:')
  assert.ok(start >= 0)
  const job = ci.slice(start)
  assert.match(job, /image: postgres:16-alpine/)
  assert.match(job, /POSTGRES_DB: moonwitness_container_ci/)
  assert.match(job, /5432:5432/)
  assert.match(job, /src\/migrations\/runner\.ts/)
  assert.match(job, /\/health\/ready/)
  assert.match(job, /\/health\/live/)
  assert.match(job, /http:\/\/127\.0\.0\.1:3000\//)
  assert.match(job, /\/health\/live/)
  assert.match(job, /\/aegis healthcheck/)
  assert.match(job, /docker rm -f moonwitness-container-smoke/)
})
