import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

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

test('product detail editor uses persisted ARSY versions and server-approved lifecycle transitions', () => {
  assert.match(workspace, /type ProductVersion/)
  assert.match(workspace, /allowedNextLifecycleStates/)
  assert.match(workspace, /Current immutable version/)
  assert.match(workspace, /Version history/)
  assert.match(workspace, /expectedVersion, brief, acceptanceCriteria/)
  assert.ok(workspace.includes('if (response.status === 409)'))
  assert.match(workspace, /current version and history were refreshed/)
  assert.match(workspace, /READY is derived from completed inspections/)
  assert.match(workspace, /LISTED requires a verified publication receipt/)
  assert.ok(proxy.includes('products/${uuid}/versions'))
  assert.ok(proxy.includes('products/${uuid}/lifecycle'))
})


test('MIZAN operator workflows are evidence-backed and remain currency-separated', () => {
  const finance = readFileSync(new URL('../src/features/money-maker/financial-operations-panel.tsx', import.meta.url), 'utf8')
  for (const path of [
    '/api/money-maker/financial-events',
    '/api/money-maker/financial-events/',
    '/api/money-maker/payouts',
    '/api/money-maker/fx-conversions',
  ]) assert.ok(finance.includes(path), 'Missing MIZAN route: ' + path)
  assert.match(finance, /allowedNextStatuses/)
  assert.match(finance, /occurredAt: toIso\(occurredAt\)/)
  assert.match(finance, /evidenceCapturedAt: toIso\(evidenceCapturedAt\)/)
  assert.match(finance, /reconciliationState === 'verified'/)
  assert.match(finance, /BigInt\(amount\)/)
  assert.match(finance, /No transfer was initiated/)
  assert.match(finance, /no cross-currency total is inferred/i)
  assert.match(proxy, /financial-events/)
  assert.match(proxy, /payouts\/\$\{uuid\}\/status/)
  assert.match(proxy, /fx-conversions/)
})


test('Aftershock presents the persisted cohort contract and does not invent unavailable metrics', async () => {
  const panel = await readFile(new URL('../src/features/money-maker/aftershock-metrics-panel.tsx', import.meta.url), 'utf8')
  assert.match(workspace, /AftershockMetricsPanel/)
  assert.match(workspace, /readData<PortfolioMetrics>/)
  assert.match(panel, /outcomeCutoffExclusive/)
  assert.match(panel, /promotionNumerator/)
  assert.match(panel, /promotionDenominator/)
  assert.match(panel, /firstSaleNumerator/)
  assert.match(panel, /firstSaleDenominator/)
  assert.match(panel, /No portfolio metric response is available/)
  assert.match(panel, /metrics\.unavailableMetrics\.discoveryToOpportunity\.reason/)
  assert.match(panel, /metrics\.unavailableMetrics\.supportBurden\.reason/)
  assert.match(panel, /Source-backed/)
  assert.doesNotMatch(panel, /estimated revenue|market demand score/i)
})
