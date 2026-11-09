import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH
const baseUrl = process.env.HEADQUARTER_E2E_URL ?? 'http://127.0.0.1:3000'
const operatorPassword = process.env.HEADQUARTER_OPERATOR_PASSWORD?.trim()
const databaseUrl = process.env.DATABASE_URL?.trim()
const operatorId = process.env.ARSY_OPERATOR_ID?.trim()

if (!playwrightPath) throw new Error('PLAYWRIGHT_PACKAGE_PATH must point to the isolated Playwright installation.')
if (!operatorPassword) throw new Error('HEADQUARTER_OPERATOR_PASSWORD must be configured for the isolated E2E runtime.')
if (!databaseUrl || !operatorId) throw new Error('DATABASE_URL and ARSY_OPERATOR_ID are required for persistence assertions.')

const { chromium } = require(playwrightPath)
const { Pool } = createRequire(new URL('../../arsy/package.json', import.meta.url))('pg')

test(
  'operator creates an evidence-backed opportunity, reloads it from PostgreSQL, and archives it',
  { timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true })
    const pool = new Pool({ connectionString: databaseUrl })
    let context
    let page
    const pageErrors = []
    const apiFailures = []
    const artifactDirectory = process.env.E2E_ARTIFACT_DIR?.trim()

    try {
      if (artifactDirectory) await mkdir(artifactDirectory, { recursive: true })
      context = await browser.newContext()
      page = await context.newPage()
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('response', (response) => {
        if (response.url().includes('/api/money-maker/') && response.status() >= 500) {
          apiFailures.push({ url: response.url(), status: response.status() })
        }
      })

      const title = `CI evidence intake ${Date.now()}`
      await page.goto(`${baseUrl}/login?returnTo=%2Fmoney-maker`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.getByTestId('operator-login-form').waitFor()
      await page.getByLabel('Operator password', { exact: true }).fill(operatorPassword)
      await page.getByRole('button', { name: 'Enter Headquarter', exact: true }).click()
      await page.waitForURL('**/money-maker')
      await page.getByRole('heading', { name: 'Money Maker Workspace', exact: true }).waitFor()
      await page.getByText('Persisted ARSY records', { exact: true }).waitFor()
      await page.getByText('No persisted opportunities yet. Capture the first evidence-backed opportunity using the intake form.', { exact: true }).waitFor()

      await page.getByLabel('Opportunity title', { exact: true }).fill(title)
      await page.getByLabel('Buyer problem', { exact: true }).fill('Operators cannot reliably reconcile stock across several sales channels.')
      await page.getByLabel('Buyer segment', { exact: true }).fill('Small online sellers')
      await page.getByLabel('Job to be done', { exact: true }).fill('Identify stock mismatches and low-stock items before fulfilling new orders.')
      await page.getByLabel('Product hypothesis', { exact: true }).fill('A lightweight digital inventory reconciliation utility with source-linked audit notes.')
      await page.getByLabel('Candidate channels (comma separated)', { exact: true }).fill('Gumroad')
      await page.getByLabel('Source name', { exact: true }).fill('Isolated CI evidence fixture')
      await page.getByLabel('Source URL', { exact: true }).fill('https://example.org/ci-evidence-fixture')
      await page.getByLabel('Source type', { exact: true }).selectOption('official-documentation')
      await page.getByLabel('Evidence class', { exact: true }).selectOption('hypothesis')
      await page.getByLabel('Evidence summary', { exact: true }).fill('Synthetic CI fixture used only to verify the persisted opportunity workflow; it is not market research.')
      await page.getByLabel('Reliability', { exact: true }).selectOption('unknown')
      await page.getByLabel('Limitations', { exact: true }).fill('Synthetic test data. No buyer demand, marketplace policy, or payout eligibility is asserted.')
      await page.getByLabel('Collection method', { exact: true }).fill('Created by the isolated Money Maker browser E2E test.')
      await page.getByLabel('Permission basis', { exact: true }).fill('Synthetic CI-only content; it contains no third-party personal or confidential data.')

      await page.getByRole('button', { name: 'Save evidence-backed intake', exact: true }).click()
      await page.getByText(
        'Opportunity captured. It remains in research until scores and hard gates are supported by evidence.',
        { exact: true }
      ).waitFor({ timeout: 30_000 })

      const createdHeading = page.getByRole('heading', { name: title, exact: true })
      await createdHeading.waitFor({ timeout: 30_000 })
      await page.getByText('research-more', { exact: true }).waitFor()
      await page.getByText('Unscored', { exact: true }).waitFor()
      await page.getByText(/4 unknown gates/).waitFor()
      await page.getByText(/7 unscored dimensions/).waitFor()

      // A full navigation reload discards client state. The same record must be read back from ARSY/PostgreSQL.
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: 'Money Maker Workspace', exact: true }).waitFor()
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30_000 })
      await page.getByText('Unscored', { exact: true }).waitFor()
      await page.getByText(/4 unknown gates/).waitFor()

      const deleteResponse = page.waitForResponse((response) =>
        response.url().includes('/api/money-maker/opportunities/') &&
        response.request().method() === 'DELETE' &&
        response.status() === 204
      )
      page.once('dialog', async (dialog) => {
        assert.equal(dialog.type(), 'confirm')
        await dialog.accept()
      })
      await page.getByRole('button', { name: 'Archive', exact: true }).click()
      await deleteResponse
      await page.getByText('Opportunity archived. Its audit record is retained.', { exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'detached', timeout: 30_000 })
      await page.getByText('No persisted opportunities yet. Capture the first evidence-backed opportunity using the intake form.', { exact: true }).waitFor()

      // Assert the durable record and its audit history directly; the application path above remains unmocked.
      const stored = await pool.query(
        'SELECT id::text AS id, archived_at FROM arsy_opportunities WHERE owner_id = $1 AND title = $2',
        [operatorId, title]
      )
      assert.equal(stored.rows.length, 1, 'the UI-created opportunity must exist in PostgreSQL')
      assert.ok(stored.rows[0].archived_at, 'the archived opportunity must remain in PostgreSQL with archived_at set')

      const audit = await pool.query(
        'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2 ORDER BY occurred_at',
        [operatorId, stored.rows[0].id]
      )
      assert.deepEqual(
        audit.rows.map((row) => row.action).sort(),
        ['archived', 'created'],
        'create and archive must both be represented in the durable commerce audit trail'
      )

      assert.deepEqual(pageErrors, [], 'the Money Maker workflow must not produce uncaught browser errors')
      assert.deepEqual(apiFailures, [], 'the Money Maker BFF must not return server errors during the workflow')
    } catch (error) {
      if (page && artifactDirectory) {
        await page.screenshot({ path: path.join(artifactDirectory, 'money-maker-failure.png'), fullPage: true }).catch(() => undefined)
      }
      throw error
    } finally {
      await context?.close()
      await browser.close()
      await pool.end()
    }
  }
)
