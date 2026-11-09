import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const workspace = await readFile(new URL('../src/features/money-maker/money-maker-workspace.tsx', import.meta.url), 'utf8')
const proxy = await readFile(new URL('../src/app/api/money-maker/[...path]/route.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/app/money-maker/page.tsx', import.meta.url), 'utf8')
const navigation = await readFile(new URL('../src/shell/navigation.ts', import.meta.url), 'utf8')

test('Money Maker workspace reads persisted ARSY resources without demo fixtures', () => {
  for (const resource of ['opportunities', 'products', 'assets', 'channels', 'listings', 'financial-events', 'payouts', 'fx-conversions', 'financial-summary', 'portfolio-metrics']) {
    assert.ok(workspace.includes(`/api/money-maker/${resource}`), `Missing live resource: ${resource}`)
  }
  assert.doesNotMatch(workspace, /DEMO DATA|sample opportunity|fake revenue/i)
  assert.match(workspace, /cache: 'no-store'/)
  assert.match(workspace, /metricsFrom\.toISOString\(\)/)
  assert.match(workspace, /metricsTo\.toISOString\(\)/)
})

test('opportunity intake is evidence-backed and starts unscored with unknown hard gates', () => {
  assert.match(workspace, /idempotency-key/)
  assert.match(workspace, /evidenceId/)
  assert.match(workspace, /scores: \{\}/)
  assert.match(workspace, /scoreDetails: \{\}/)
  assert.match(workspace, /rights: 'unknown'/)
  assert.match(workspace, /countryEligibility: 'unknown'/)
  assert.match(workspace, /channelPolicy: 'unknown'/)
  assert.match(workspace, /payoutFeasibility: 'unknown'/)
  assert.match(workspace, /An operator review with supporting evidence is required/)
  assert.match(workspace, /Review scores & hard gates/)
  assert.match(workspace, /expectedVersion: opportunity.version/)
  assert.match(workspace, /evidenceIds: \[evidenceId\]/)
  assert.match(workspace, /Create product brief/)
  assert.match(workspace, /acceptanceCriteria/)
})

test('the server proxy uses the authenticated ARSY boundary and a finite route/method allowlist', () => {
  assert.match(proxy, /proxyArsyRequest/)
  assert.match(proxy, /routes\.some/)
  assert.match(proxy, /route\.methods\.includes\(method\)/)
  assert.match(proxy, /NOT_FOUND/)
  assert.match(proxy, /encodeURIComponent/)
  assert.doesNotMatch(proxy, /assets\/\$\{uuid\}\/download/)
})

test('Money Maker workspace is routable and discoverable in Headquarter navigation', () => {
  assert.match(page, /MoneyMakerWorkspace/)
  assert.match(navigation, /href: '\/money-maker'/)
})
