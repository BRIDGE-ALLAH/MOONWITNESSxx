import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

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
  'operator creates immutable product versions, handles stale writes, and changes only allowed lifecycle states',
  { timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true })
    const pool = new Pool({ connectionString: databaseUrl })
    const productId = randomUUID()
    const initialVersionId = randomUUID()
    const title = `CI product lifecycle ${Date.now()}`
    let context
    let page

    try {
      await pool.query(
        `INSERT INTO arsy_products
          (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by)
         VALUES ($1, $2, NULL, $3, 'digital-utility', 'brief', $2, $2)`,
        [productId, operatorId, title],
      )
      await pool.query(
        `INSERT INTO arsy_product_versions
          (id, product_id, version, brief, acceptance_criteria, created_by)
         VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)`,
        [initialVersionId, productId, JSON.stringify({ summary: 'Initial immutable brief' }), JSON.stringify(['Initial acceptance criterion']), operatorId],
      )

      context = await browser.newContext()
      page = await context.newPage()
      await page.goto(`${baseUrl}/login?returnTo=%2Fmoney-maker`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.getByTestId('operator-login-form').waitFor()
      await page.getByLabel('Operator password', { exact: true }).fill(operatorPassword)
      await page.getByRole('button', { name: 'Enter Headquarter', exact: true }).click()
      await page.waitForURL('**/money-maker')
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30_000 })

      await page.getByRole('button', { name: 'View version history', exact: true }).click()
      await page.getByText('Version 1', { exact: true }).first().waitFor()

      await page.getByLabel('Product brief JSON').fill(JSON.stringify({ summary: 'Concurrent version written by another operator session' }, null, 2))
      await page.getByLabel('Acceptance criteria (one per line)').fill('Concurrent write is retained as an immutable snapshot.')

      // Simulate another operator winning the optimistic-concurrency race through the real authenticated BFF.
      const concurrentWrite = await page.evaluate(async ({ productId }) => {
        const response = await fetch(`/api/money-maker/products/${productId}/versions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: 1,
            brief: { summary: 'Concurrent version written by another operator session' },
            acceptanceCriteria: ['Concurrent write is retained as an immutable snapshot.'],
          }),
        })
        return { status: response.status, body: await response.json().catch(() => ({})) }
      }, { productId })
      assert.equal(concurrentWrite.status, 201, 'the competing version must be persisted through the real API')

      await page.getByRole('button', { name: 'Create version', exact: true }).click()
      await page.getByText(
        'Version conflict: this product changed after it was loaded. The latest persisted version has been refreshed; review it before saving again.',
        { exact: true },
      ).waitFor({ timeout: 30_000 })
      await page.getByText('Version 2', { exact: true }).first().waitFor({ timeout: 30_000 })

      // The refreshed version-2 record is now the expectedVersion for the next write.
      await page.getByLabel('Product brief JSON').fill(JSON.stringify({ summary: 'Version created from refreshed product state' }, null, 2))
      await page.getByLabel('Acceptance criteria (one per line)').fill('Version three is durable after a browser reload.')
      await page.getByRole('button', { name: 'Create version', exact: true }).click()
      await page.getByText('Version 3 saved. Previous versions remain immutable.', { exact: true }).waitFor({ timeout: 30_000 })
      const historyRegion = page.getByRole('region', { name: 'Product version history' })
      await historyRegion.getByText('Version 3', { exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Move to review', exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Move to review', exact: true }).click()
      await page.getByText('Product moved to review.', { exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Move to ready', exact: true }).waitFor({ state: 'detached' })

      const invalidDerivedTransition = await page.evaluate(async ({ productId }) => {
        const response = await fetch(`/api/money-maker/products/${productId}/lifecycle`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lifecycleState: 'ready' }),
        })
        return response.status
      }, { productId })
      assert.equal(invalidDerivedTransition, 409, 'ARSY must reject a manually requested derived ready state')

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30_000 })
      await page.getByText('Version 3', { exact: true }).first().waitFor()
      await page.getByText('review', { exact: true }).first().waitFor()
      await page.getByRole('button', { name: 'Move to ready', exact: true }).waitFor({ state: 'detached' })

      const stored = await pool.query(
        'SELECT lifecycle_state FROM arsy_products WHERE owner_id = $1 AND id = $2',
        [operatorId, productId],
      )
      assert.equal(stored.rows[0]?.lifecycle_state, 'review')
      const versions = await pool.query(
        'SELECT version FROM arsy_product_versions WHERE product_id = $1 ORDER BY version',
        [productId],
      )
      assert.deepEqual(versions.rows.map((row) => row.version), [1, 2, 3])

      const audit = await pool.query(
        'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2 ORDER BY occurred_at',
        [operatorId, productId],
      )
      assert.deepEqual(
        audit.rows.map((row) => row.action).sort(),
        ['lifecycle-changed', 'version-created', 'version-created'],
      )
    } finally {
      if (context) await context.close()
      await browser.close()
      await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_id = $2', [operatorId, productId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_product_versions WHERE product_id = $1', [productId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_products WHERE owner_id = $1 AND id = $2', [operatorId, productId]).catch(() => undefined)
      await pool.end()
    }
  },
)
