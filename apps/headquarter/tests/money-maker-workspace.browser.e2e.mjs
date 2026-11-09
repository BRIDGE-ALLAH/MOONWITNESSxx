import test from 'node:test'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
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
      await page.getByLabel('Source type').selectOption('official-documentation')
      await page.getByLabel('Evidence class').selectOption('hypothesis')
      const intakeForm = page.locator('form').filter({ has: page.getByLabel('Opportunity title', { exact: true }) })
      await intakeForm.getByLabel('Evidence summary', { exact: true }).fill('Synthetic CI fixture used only to verify the persisted opportunity workflow; it is not market research.')
      await page.getByLabel('Reliability').selectOption('unknown')
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


test(
  'operator creates immutable product versions, handles stale writes and applies only domain-approved lifecycle transitions',
  { timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true })
    const pool = new Pool({ connectionString: databaseUrl })
    let context
    let page
    const productId = randomUUID()
    const initialVersionId = randomUUID()
    const title = 'CI product lifecycle ' + Date.now()

    try {
      await pool.query(
        "INSERT INTO arsy_products " +
          "(id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by) " +
          "VALUES ($1, $2, NULL, $3, 'digital-utility', 'brief', $2, $2)",
        [productId, operatorId, title]
      )
      await pool.query(
        "INSERT INTO arsy_product_versions " +
          "(id, product_id, version, brief, acceptance_criteria, created_by) " +
          "VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)",
        [
          initialVersionId,
          productId,
          JSON.stringify({ buyerProblem: 'Inventory mismatches are hard to audit.' }),
          JSON.stringify(['Imports a source inventory file']),
          operatorId,
        ]
      )

      context = await browser.newContext()
      page = await context.newPage()
      await page.goto(baseUrl + '/login?returnTo=%2Fmoney-maker', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.getByTestId('operator-login-form').waitFor()
      await page.getByLabel('Operator password', { exact: true }).fill(operatorPassword)
      await page.getByRole('button', { name: 'Enter Headquarter', exact: true }).click()
      await page.waitForURL('**/money-maker')
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Open product details', exact: true }).click()
      await page.getByText('Current immutable version: v1', { exact: true }).waitFor()
      await page.getByText('Version history', { exact: true }).waitFor()
      await page.getByText('Version 1', { exact: true }).waitFor()

      await page.getByLabel('New product brief (JSON)', { exact: true }).fill(JSON.stringify({
        buyerProblem: 'A stale operator edit must not overwrite a newer product version.',
      }, null, 2))
      await page.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill('Reject stale expected versions')

      // Simulate a second authenticated operator action after the UI loaded v1.
      // This uses the real Headquarter BFF -> ARSY -> PostgreSQL path, not an API mock.
      const competingWrite = await page.evaluate(async ({ id }) => {
        const response = await fetch('/api/money-maker/products/' + id + '/versions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: 1,
            brief: { buyerProblem: 'A concurrent operator update won the version race.' },
            acceptanceCriteria: ['Preserves the concurrent operator change'],
          }),
        })
        return { status: response.status, payload: await response.json() }
      }, { id: productId })
      assert.equal(competingWrite.status, 201, 'the concurrent version 2 write must succeed')
      assert.equal(competingWrite.payload.data.version, 2)

      await page.getByRole('button', { name: 'Create version from v1', exact: true }).click()
      await page.getByText(
        'This product changed after it was loaded. The current version and history were refreshed; review them before saving again.',
        { exact: true }
      ).waitFor({ timeout: 30_000 })
      await page.getByText('Current immutable version: v2', { exact: true }).waitFor()
      await page.getByText('Version 2', { exact: true }).waitFor()

      await page.getByLabel('New product brief (JSON)', { exact: true }).fill(JSON.stringify({
        buyerProblem: 'Inventory reconciliation needs traceable imports and exports.',
        operatorRevision: 'version-three',
      }, null, 2))
      await page.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill(
        'Imports source inventory rows\nExports a traceable reconciliation report'
      )
      await page.getByRole('button', { name: 'Create version from v2', exact: true }).click()
      await page.getByText('Product version 3 saved to ARSY.', { exact: true }).waitFor({ timeout: 30_000 })
      await page.getByText('Current immutable version: v3', { exact: true }).waitFor()
      await page.getByText('Current lifecycle: production', { exact: true }).waitFor()

      const invalidTransition = await page.evaluate(async ({ id }) => {
        const response = await fetch('/api/money-maker/products/' + id + '/lifecycle', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lifecycleState: 'ready' }),
        })
        return { status: response.status, payload: await response.json() }
      }, { id: productId })
      assert.equal(invalidTransition.status, 409, 'READY must not be operator-settable')
      assert.equal(invalidTransition.payload.error.code, 'INVALID_LIFECYCLE_TRANSITION')
      assert.equal(await page.getByRole('button', { name: 'Move to ready', exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Move to listed', exact: true }).count(), 0)

      await page.getByRole('button', { name: 'Move to review', exact: true }).click()
      await page.getByText('Current lifecycle: review', { exact: true }).waitFor({ timeout: 30_000 })

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Open product details', exact: true }).click()
      await page.getByText('Current immutable version: v3', { exact: true }).waitFor()
      await page.getByText('Current lifecycle: review', { exact: true }).waitFor()
      for (const version of [1, 2, 3]) {
        await page.getByText('Version ' + version, { exact: true }).waitFor()
      }

      const stored = await pool.query(
        'SELECT lifecycle_state FROM arsy_products WHERE owner_id = $1 AND id = $2',
        [operatorId, productId]
      )
      assert.equal(stored.rows.length, 1)
      assert.equal(stored.rows[0].lifecycle_state, 'review')

      const persistedVersions = await pool.query(
        'SELECT version, brief, acceptance_criteria FROM arsy_product_versions WHERE product_id = $1 ORDER BY version',
        [productId]
      )
      assert.deepEqual(persistedVersions.rows.map((row) => row.version), [1, 2, 3])
      assert.equal(persistedVersions.rows[1].brief.buyerProblem, 'A concurrent operator update won the version race.')
      assert.equal(persistedVersions.rows[2].brief.operatorRevision, 'version-three')
      assert.deepEqual(persistedVersions.rows[2].acceptance_criteria, [
        'Imports source inventory rows',
        'Exports a traceable reconciliation report',
      ])

      const audit = await pool.query(
        'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 AND aggregate_type = $2 AND aggregate_id = $3 ORDER BY occurred_at',
        [operatorId, 'product', productId]
      )
      assert.deepEqual(
        audit.rows.map((row) => row.action).sort(),
        ['lifecycle-changed', 'version-created', 'version-created'],
        'each accepted version and lifecycle change must be represented in the durable audit trail'
      )
    } finally {
      await context?.close()
      await browser.close()
      await pool.end()
    }
  }
)


test(
  'operator records, verifies and converts a financial event through Headquarter and PostgreSQL',
  { timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true })
    const pool = new Pool({ connectionString: databaseUrl })
    let context
    let page
    const pageErrors = []
    const apiFailures = []
    const providerReference = 'ci-mizan-' + randomUUID()
    const payoutProviderReference = 'ci-mizan-payout-' + randomUUID()
    const payoutChannelId = randomUUID()
    const payoutChannelKey = 'mizan-ci-' + randomUUID()
    const artifactDirectory = process.env.E2E_ARTIFACT_DIR?.trim()

    try {
      const policyReviewedAt = new Date()
      const policyRecheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await pool.query(
        `INSERT INTO arsy_channels
          (id, owner_id, channel_key, display_name, country_code, account_eligibility,
           official_policy_url, policy_reviewed_at, policy_recheck_at, payout_requirements,
           listing_requirements, payout_setup_status, capability, granted_scopes, quota_notes,
           channel_status, created_by, updated_by)
         VALUES ($1, $2, $3, 'MIZAN synthetic CI payout channel', 'ID', 'eligible',
           'https://example.com/ci-policy', $4, $5, '{}'::jsonb, '{}'::jsonb, 'configured',
           'C1', '[]'::jsonb, '{}'::jsonb, 'active', $2, $2)`,
        [payoutChannelId, operatorId, payoutChannelKey, policyReviewedAt, policyRecheckAt],
      )
      for (const evidenceType of ['official-policy', 'account-eligibility', 'payout-requirements', 'format-requirements']) {
        await pool.query(
          `INSERT INTO arsy_channel_evidence
            (id, owner_id, channel_id, evidence_type, source_name, source_url, captured_at,
             reviewed_at, evidence_class, summary, limitations, created_by)
           VALUES ($1, $2, $3, $4, 'Synthetic MIZAN browser fixture',
             $5, now(), now(), 'observed-fact', $6, 'Synthetic CI only; no real provider access.', $2)`,
          [
            randomUUID(), operatorId, payoutChannelId, evidenceType,
            'https://example.com/ci-evidence/' + evidenceType,
            'Synthetic source fixture for ' + evidenceType + ' acceptance.',
          ],
        )
      }

      context = await browser.newContext()
      page = await context.newPage()
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('response', (response) => {
        if (response.url().includes('/api/money-maker/') && response.status() >= 500) {
          apiFailures.push({ url: response.url(), status: response.status() })
        }
      })

      await page.goto(baseUrl + '/login?returnTo=%2Fmoney-maker', { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle')
      await page.getByTestId('operator-login-form').waitFor()
      await page.getByLabel('Operator password', { exact: true }).fill(operatorPassword)
      await page.getByRole('button', { name: 'Enter Headquarter', exact: true }).click()
      await page.waitForURL('**/money-maker')
      await page.getByRole('heading', { name: 'Money Maker Workspace', exact: true }).waitFor()
      await page.getByRole('heading', { name: 'MIZAN · Currency-separated ledger', exact: true }).waitFor()
      await page.getByText('No reconciled balances yet. Pending entries remain separate from verified totals.', { exact: true }).waitFor()

      const financialEventForm = page.getByTestId('financial-event-form')
      await financialEventForm.waitFor({ state: 'visible', timeout: 30_000 })
      assert.equal(await financialEventForm.getByTestId('financial-event-type').count(), 1)
      await financialEventForm.getByTestId('financial-event-type').selectOption('gross-receipt')
      await page.getByLabel('Amount in minor units', { exact: true }).first().fill('12500')
      await page.getByLabel('Currency', { exact: true }).first().fill('IDR')
      await page.getByLabel('Event occurred at', { exact: true }).fill(new Date(Date.now() - 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
      await page.getByTestId('financial-event-form').getByLabel('Source', { exact: true }).fill('Synthetic CI bank statement')
      await financialEventForm.getByLabel('Provider reference (optional)', { exact: true }).fill(providerReference)
      await page.getByRole('button', { name: 'Record pending event', exact: true }).click()
      await page.getByText('Financial event recorded as pending.', { exact: false }).waitFor({ timeout: 30_000 })

      const pendingEvent = page.getByTestId('financial-event-item').filter({ hasText: providerReference })
      await pendingEvent.waitFor({ state: 'visible', timeout: 30_000 })
      assert.equal(await pendingEvent.getAttribute('data-reconciliation-state'), 'pending')
      const reconciliationForm = pendingEvent.getByTestId('event-reconciliation-form')
      await reconciliationForm.getByTestId('event-reconciliation-result').selectOption('verified')
      await reconciliationForm.getByLabel('Rationale', { exact: true }).fill('Matched against the synthetic CI statement row.')
      await reconciliationForm.getByLabel('Evidence URL', { exact: true }).fill('https://example.com/ci-mizan-statement')
      await reconciliationForm.getByRole('button', { name: 'Save reconciliation', exact: true }).click()
      await page.getByText('Financial event reconciliation saved as verified.', { exact: true }).waitFor({ timeout: 30_000 })
      await pendingEvent.waitFor({ state: 'visible' })
      await expect(pendingEvent).toHaveAttribute('data-reconciliation-state', 'verified')

      await page.getByTestId('fx-conversion-form').getByTestId('verified-source-event').selectOption({ index: 0 })
      await page.getByLabel('Target currency', { exact: true }).fill('USD')
      await page.getByLabel('Rate numerator', { exact: true }).fill('1')
      await page.getByLabel('Rate denominator', { exact: true }).fill('100')
      await page.getByLabel('Rate source', { exact: true }).fill('Synthetic CI fixed rational rate')
      await page.getByText('Calculated target amount: 125', { exact: false }).waitFor()
      await page.getByLabel('FX evidence URL', { exact: true }).fill('https://example.com/ci-mizan-fx-rate')
      await page.getByLabel('Rate observed at', { exact: true }).fill(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
      await page.getByRole('button', { name: 'Record FX conversion', exact: true }).click()
      await page.getByText('FX conversion provenance recorded.', { exact: true }).waitFor({ timeout: 30_000 })

      const payoutForm = page.getByTestId('payout-create-form')
      await payoutForm.getByLabel('Payout channel', { exact: true }).selectOption({ label: 'MIZAN synthetic CI payout channel' })
      await payoutForm.getByLabel('Amount in minor units', { exact: true }).fill('5100')
      await payoutForm.getByLabel('Currency', { exact: true }).fill('IDR')
      await payoutForm.getByLabel('Provider reference (optional)', { exact: true }).fill(payoutProviderReference)
      await payoutForm.getByLabel('Source', { exact: true }).fill('Synthetic CI payout statement')
      await payoutForm.getByLabel('Initial statement evidence URL', { exact: true }).fill('https://example.com/ci-payout-statement')
      await payoutForm.getByLabel('Evidence captured at', { exact: true }).fill(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
      await payoutForm.getByLabel('Evidence summary', { exact: true }).fill('Synthetic CI statement row for the operator payout workflow.')
      await payoutForm.getByRole('button', { name: 'Record pending payout', exact: true }).click()
      await page.getByText('Payout recorded as pending.', { exact: false }).waitFor({ timeout: 30_000 })

      const payoutCard = page.locator('article').filter({ hasText: payoutProviderReference }).first()
      await payoutCard.getByLabel('Next allowed status', { exact: true }).selectOption('paid')
      const payoutOccurredAtInput = new Date(Date.now() - 120_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      const payoutOccurredAt = new Date(payoutOccurredAtInput).toISOString()
      await payoutCard.getByLabel('Statement event occurred at', { exact: true }).fill(payoutOccurredAtInput)
      await payoutCard.getByLabel('Evidence captured at', { exact: true }).fill(new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
      await payoutCard.getByLabel('Statement evidence URL', { exact: true }).fill('https://example.com/ci-paid-statement')
      await payoutCard.getByLabel('Reconciliation rationale', { exact: true }).fill('Synthetic CI payout statement confirms the paid event.')
      await payoutCard.getByRole('button', { name: 'Save payout transition', exact: true }).click()
      await page.getByText('Payout status saved as paid.', { exact: false }).waitFor({ timeout: 30_000 })

      const persistedPayout = await pool.query(
        'SELECT id, status, paid_at FROM arsy_payouts WHERE owner_id = $1 AND provider_reference = $2',
        [operatorId, payoutProviderReference]
      )
      assert.equal(persistedPayout.rows.length, 1)
      assert.equal(persistedPayout.rows[0].status, 'paid')
      assert.equal(new Date(persistedPayout.rows[0].paid_at).toISOString(), payoutOccurredAt)

      const payoutHistory = await pool.query(
        'SELECT to_status, occurred_at, recorded_at FROM arsy_payout_events WHERE owner_id = $1 AND payout_id = $2 ORDER BY recorded_at ASC',
        [operatorId, persistedPayout.rows[0].id]
      )
      assert.deepEqual(payoutHistory.rows.map((row) => row.to_status), ['pending', 'paid'])
      assert.equal(new Date(payoutHistory.rows[1].occurred_at).toISOString(), payoutOccurredAt)
      assert.ok(Date.parse(payoutHistory.rows[1].recorded_at) >= Date.parse(payoutHistory.rows[0].recorded_at))

      const payoutLedger = await pool.query(
        'SELECT event_type, amount_minor::text AS amount_minor, currency, reconciliation_state FROM arsy_financial_events WHERE owner_id = $1 AND provider_reference = $2',
        [operatorId, payoutProviderReference]
      )
      assert.deepEqual(payoutLedger.rows, [{
        event_type: 'payout',
        amount_minor: '5100',
        currency: 'IDR',
        reconciliation_state: 'verified',
      }])

      const persistedEvent = await pool.query(
        'SELECT id, reconciliation_state, amount_minor::text AS amount_minor, currency FROM arsy_financial_events WHERE owner_id = $1 AND provider_reference = $2',
        [operatorId, providerReference]
      )
      assert.equal(persistedEvent.rows.length, 1)
      assert.equal(persistedEvent.rows[0].reconciliation_state, 'verified')
      assert.equal(persistedEvent.rows[0].amount_minor, '12500')
      assert.equal(persistedEvent.rows[0].currency, 'IDR')

      const persistedFx = await pool.query(
        'SELECT from_amount_minor::text AS from_amount_minor, from_currency, to_amount_minor::text AS to_amount_minor, to_currency, rate_numerator::text AS numerator, rate_denominator::text AS denominator FROM arsy_fx_conversions WHERE owner_id = $1 AND source_event_id = $2',
        [operatorId, persistedEvent.rows[0].id]
      )
      assert.equal(persistedFx.rows.length, 1)
      assert.deepEqual(persistedFx.rows[0], {
        from_amount_minor: '12500',
        from_currency: 'IDR',
        to_amount_minor: '125',
        to_currency: 'USD',
        numerator: '1',
        denominator: '100',
      })
      assert.deepEqual(pageErrors, [])
      assert.deepEqual(apiFailures, [])
    } finally {
      if (page && artifactDirectory) {
        await page.screenshot({ path: path.join(artifactDirectory, 'mizan-ledger-workflow.png'), fullPage: true }).catch(() => undefined)
      }
      await context?.close()
      await browser.close()
      await pool.query('DELETE FROM arsy_fx_conversions WHERE owner_id = $1 AND source_event_id IN (SELECT id FROM arsy_financial_events WHERE provider_reference = $2)', [operatorId, providerReference]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_payout_events WHERE owner_id = $1 AND payout_id IN (SELECT id FROM arsy_payouts WHERE owner_id = $1 AND channel_id = $2)', [operatorId, payoutChannelId]).catch(() => undefined)
      await pool.query(`DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1 AND (
        (aggregate_type = 'channel' AND aggregate_id = $2)
        OR (aggregate_type = 'payout' AND aggregate_id IN (
          SELECT id FROM arsy_payouts WHERE owner_id = $1 AND channel_id = $2
        ))
      )`, [operatorId, payoutChannelId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_financial_events WHERE owner_id = $1 AND provider_reference IN ($2, $3)', [operatorId, providerReference, payoutProviderReference]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_payouts WHERE owner_id = $1 AND channel_id = $2', [operatorId, payoutChannelId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_channel_evidence WHERE owner_id = $1 AND channel_id = $2', [operatorId, payoutChannelId]).catch(() => undefined)
      await pool.query('DELETE FROM arsy_channels WHERE owner_id = $1 AND id = $2', [operatorId, payoutChannelId]).catch(() => undefined)
      await pool.end()
    }
  }
)
