import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH
const baseUrl = process.env.HEADQUARTER_E2E_URL ?? 'http://127.0.0.1:3000'
const operatorPassword = process.env.HEADQUARTER_OPERATOR_PASSWORD?.trim()

if (!playwrightPath)
  throw new Error('PLAYWRIGHT_PACKAGE_PATH must point to the isolated Playwright installation.')
if (!operatorPassword)
  throw new Error('HEADQUARTER_OPERATOR_PASSWORD must be configured for the isolated E2E runtime.')

const { chromium } = require(playwrightPath)

test(
  'operator records a real governance snapshot that persists across reload and archives through Headquarter',
  {
    timeout: 180_000,
  },
  async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      const label = `E2E governance review ${Date.now()}`

      await page.goto(`${baseUrl}/login?returnTo=%2Fgovernance-lab`, {
        waitUntil: 'domcontentloaded',
      })
      // Next.js client handlers must be hydrated before submitting; otherwise the
      // browser falls back to a native GET form submission and drops the returnTo.
      await page.waitForLoadState('networkidle')
      await page.getByTestId('operator-login-form').waitFor()
      await page.getByLabel('Operator password').fill(operatorPassword)
      await page.getByRole('button', { name: 'Enter Headquarter' }).click()
      await page.waitForURL('**/governance-lab')
      await page.getByRole('heading', { name: 'Governance Lab' }).waitFor()

      // Live mode must reach the persisted ARSY list, not the client-side demo fixtures.
      await page.getByText('LIVE // PERSISTED VIA ARSY').waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Record new snapshot' }).click()
      await page.getByRole('heading', { name: 'Record a governance snapshot' }).waitFor()

      await page.getByLabel('Snapshot label', { exact: true }).fill(label)
      await page.getByLabel('Node 1 label', { exact: true }).fill('Approve distribution change')
      await page.getByLabel('Metric 1 label', { exact: true }).fill('Throughput')
      await page.getByLabel('Metric 1 low', { exact: true }).fill('10')
      await page.getByLabel('Metric 1 base', { exact: true }).fill('12')
      await page.getByLabel('Metric 1 high', { exact: true }).fill('15')
      await page.getByLabel('Metric 1 unit', { exact: true }).fill('items')
      await page.getByLabel('Baseline 1 label', { exact: true }).fill('Throughput')
      await page.getByLabel('Baseline 1 value', { exact: true }).fill('12')
      await page.getByLabel('Baseline 1 unit', { exact: true }).fill('items')
      await page.getByLabel('Scenario title', { exact: true }).fill('Capacity improvement review')

      await page.getByRole('button', { name: 'Persist snapshot' }).click()

      // The composer closes and the freshly persisted snapshot becomes selected.
      await page.getByText(/SNAPSHOT:/).waitFor({ timeout: 30_000 })
      await page.getByText(label, { exact: true }).first().waitFor({ timeout: 30_000 })

      // A full browser reload must recover the snapshot from PostgreSQL through ARSY;
      // no component-only state may be required for it to reappear.
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: 'Governance Lab' }).waitFor()
      await page.getByText('LIVE // PERSISTED VIA ARSY').waitFor({ timeout: 30_000 })
      const persisted = page.getByText(label, { exact: true }).first()
      await persisted.waitFor({ timeout: 30_000 })
      await persisted.click()

      await page.getByRole('button', { name: 'Archive snapshot' }).click()
      await page
        .getByText(/ARCHIVED/, { exact: false })
        .first()
        .waitFor({ timeout: 30_000 })

      assert.deepEqual(
        pageErrors,
        [],
        'the governance workflow must not produce uncaught browser errors'
      )
      await context.close()
    } finally {
      await browser.close()
    }
  }
)
