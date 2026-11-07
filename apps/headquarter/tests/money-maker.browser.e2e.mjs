import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH
const baseUrl = process.env.HEADQUARTER_E2E_URL ?? 'http://127.0.0.1:3000'
const operatorPassword = process.env.HEADQUARTER_OPERATOR_PASSWORD?.trim()

if (!playwrightPath) throw new Error('PLAYWRIGHT_PACKAGE_PATH must point to the isolated Playwright installation.')
if (!operatorPassword) throw new Error('HEADQUARTER_OPERATOR_PASSWORD must be configured for the isolated E2E runtime.')

const { chromium } = require(playwrightPath)
const localDateTime = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString().slice(0, 16)

test('operator completes the persisted commerce journey; anonymous visitors cannot read records', {
  timeout: 300_000,
}, async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const runId = Date.now().toString()
    const title = `Browser E2E product fixture ${runId}`
    const channelSlug = `e2e-${runId}`
    const channelName = `E2E Manual Channel ${runId}`

    // This test runs against an isolated CI PostgreSQL database. All market,
    // rights, channel and financial records below are synthetic test fixtures.
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Operator password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Enter Headquarter' }).click()
    await page.waitForURL('**/riot-radar')
    await page.getByRole('heading', { name: 'RIOT RADAR' }).waitFor()

    await page.getByLabel('Opportunity title').fill(title)
    await page.getByLabel('Buyer segment').fill('Isolated browser test operators')
    await page.getByLabel('Buyer problem').fill('Operators need proof that an evidence-backed opportunity becomes a persisted product through the real application.')
    await page.getByLabel('Job to be done').fill('Create a test-only opportunity and carry it through product quality and manual distribution review.')
    await page.getByLabel('Product hypothesis').fill('A persisted opportunity can be promoted to a versioned product brief after all hard gates pass.')
    await page.getByLabel('Source name').fill('MOONWITNESS isolated browser E2E fixture')
    await page.getByLabel('Canonical source URL').fill('https://example.com/moonwitness-browser-e2e-fixture')
    await page.getByLabel('Collection method').fill('Synthetic Playwright browser test fixture.')
    await page.getByLabel('Permission basis').fill('Test-only placeholder URL; no external market claim is asserted.')
    await page.getByLabel('Evidence summary').fill('Synthetic evidence record used only to verify browser-to-PostgreSQL persistence and business logic.')
    await page.getByLabel('Limitations').fill('This fixture does not establish market demand, licensing, country eligibility, or provider approval.')

    const scores = [
      ['Demand evidence', 24],
      ['Competition / quality gap', 19],
      ['Usefulness / differentiation', 14],
      ['Marketplace / buyer-intent fit', 13],
      ['Production feasibility', 9],
      ['Durability / repeat demand', 9],
      ['Distribution readiness', 4],
    ]
    for (const [label, value] of scores) {
      await page.getByLabel(`${label} score`).fill(String(value))
      await page.getByLabel(`${label} rationale`).fill('Synthetic CI-only assessment; not a real market validation claim.')
      await page.getByLabel(`${label} confidence`).selectOption('high')
    }

    const gates = ['Rights & licensing', 'Country eligibility', 'Channel policy', 'Payout feasibility']
    for (const label of gates) {
      await page.getByLabel(`${label} gate status`).selectOption('pass')
      await page.getByLabel(`${label} gate rationale`).fill('Synthetic CI fixture only; no real provider, licensing, or country eligibility verification is claimed.')
    }

    await page.getByRole('button', { name: 'Save evidence-backed opportunity' }).click()
    await page.getByRole('status').filter({ hasText: 'Opportunity saved.' }).waitFor()
    await page.getByRole('heading', { name: title, exact: true }).waitFor()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'RIOT RADAR' }).waitFor()
    await page.getByRole('heading', { name: title, exact: true }).waitFor()

    // The operator decision is a persisted, audited override, separate from the calculated score.
    const opportunityCard = page.locator('article').filter({ hasText: title }).first()
    await opportunityCard.getByLabel(`Decision for ${title}`).selectOption('research-more')
    await opportunityCard.getByLabel(`Decision rationale for ${title}`).fill('Wait for a second independent source before promotion.')
    await opportunityCard.getByRole('button', { name: 'Save decision' }).click()
    await page.getByRole('status').filter({ hasText: 'Decision updated and recorded in the audit trail.' }).waitFor()
    await opportunityCard.getByLabel(`Decision for ${title}`).selectOption('prototype-candidate')
    await opportunityCard.getByLabel(`Decision rationale for ${title}`).fill('The isolated fixture meets the configured test promotion gate.')
    await opportunityCard.getByRole('button', { name: 'Save decision' }).click()
    await page.getByRole('status').filter({ hasText: 'Decision updated and recorded in the audit trail.' }).waitFor()

    // Promotion writes a real versioned Product/ProductVersion record.
    await page.goto(`${baseUrl}/the-forge`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'THE FORGE' }).waitFor()
    await page.getByLabel('Acceptance criteria').fill('Persists the product brief in PostgreSQL\nKeeps the opportunity and evidence provenance linked')
    await page.getByRole('button', { name: 'Create version 1 product brief' }).click()
    await page.getByRole('status').filter({ hasText: `Product brief created: ${title}` }).waitFor()

    const productCard = page.locator('article').filter({ hasText: title }).first()
    await productCard.getByLabel(`Lifecycle state for ${title}`).selectOption('production')
    await page.getByRole('status').filter({ hasText: `Product lifecycle updated: ${title} · production` }).waitFor()

    // Upload a real binary into the isolated local asset store and persist its provenance/checksum.
    await productCard.getByText('Upload asset with provenance').click()
    await productCard.getByLabel('File (PDF, ZIP, JSON, TXT, PNG, JPEG, WebP)').setInputFiles({
      name: 'browser-e2e-asset.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Synthetic browser E2E asset; isolated test fixture only.'),
    })
    await productCard.getByLabel('Rights state').selectOption('pass')
    await productCard.getByLabel('Creator / owner').fill('MOONWITNESS browser E2E test fixture')
    await productCard.getByLabel('License').fill('Original test fixture; not a distributable production asset')
    await productCard.getByLabel('Original-work declaration').fill('Generated only for the isolated browser E2E test.')
    await productCard.getByLabel('Disclosure').fill('Synthetic CI fixture; no external ownership or license claim.')
    await productCard.getByRole('button', { name: 'Upload to this version' }).click()
    await productCard.getByRole('status').filter({ hasText: 'Uploaded browser-e2e-asset.txt; SHA-256' }).waitFor()
    await productCard.getByText('browser-e2e-asset.txt', { exact: true }).first().waitFor()

    // All four latest inspections plus at least one active rights-cleared asset are
    // required before ARSY can derive the product's READY state.
    await page.goto(`${baseUrl}/zill-watch`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'ZILL WATCH' }).waitFor()
    const inspectionCard = page.locator('article').filter({ hasText: title }).first()
    await inspectionCard.waitFor()

    const inspectionTypes = ['rights', 'policy', 'technical', 'creative']
    for (const [index, inspectionType] of inspectionTypes.entries()) {
      await inspectionCard.getByLabel('Inspection type').selectOption(inspectionType)
      await inspectionCard.getByLabel('Result').selectOption('pass')
      await inspectionCard.getByLabel('Finding / rationale').fill(`Synthetic CI-only ${inspectionType} checklist fixture; not an independent rights or policy certification.`)
      if (inspectionType === 'rights' || inspectionType === 'policy') {
        await inspectionCard.getByLabel('Evidence URL (required for rights/policy pass)').fill(`https://example.com/e2e-${inspectionType}-fixture`)
      }
      await inspectionCard.getByRole('button', { name: 'Record append-only inspection' }).click()
      const expectedMessage = index === inspectionTypes.length - 1
        ? 'All four latest inspections pass and every active asset has cleared rights. Product lifecycle is READY.'
        : 'Inspection recorded. Product remains in REVIEW until all four latest inspections pass and every active asset has cleared rights.'
      await page.getByRole('status').filter({ hasText: expectedMessage }).waitFor()
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'ZILL WATCH' }).waitFor()
    const readyCard = page.locator('article').filter({ hasText: title }).first()
    await readyCard.getByText('4/4 PASSED').waitFor()
    await readyCard.getByText('Version 1 · ready').waitFor()

    // Channel C0 -> C1 requires explicit, attributable test evidence. C1 only
    // authorizes a manual listing package; the browser test never publishes it.
    await page.goto(`${baseUrl}/launch-bay`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'LAUNCH BAY' }).waitFor()
    await page.getByText('No channels registered.').waitFor()
    await page.getByLabel('Channel slug').fill(channelSlug)
    await page.getByLabel('Display name').fill(channelName)
    await page.getByRole('button', { name: 'Add C0 channel' }).click()
    await page.getByRole('status').filter({ hasText: `Channel added as C0 research-only: ${channelName}.` }).waitFor()

    const channelCard = page.locator('article').filter({ hasText: channelSlug }).first()
    await channelCard.waitFor()
    await channelCard.getByLabel('Indonesia account eligibility').selectOption('pass')
    await channelCard.getByLabel('Eligibility evidence URL').fill('https://example.com/e2e-country-eligibility-fixture')
    await channelCard.getByLabel('Eligibility checked at').fill(localDateTime(-60_000))
    await channelCard.getByLabel('Payout requirements').selectOption('pass')
    await channelCard.getByLabel('Payout evidence URL').fill('https://example.com/e2e-payout-requirements-fixture')
    await channelCard.getByLabel('Payout checked at').fill(localDateTime(-60_000))
    await channelCard.getByLabel('Payout notes').fill('Synthetic CI-only payout requirements fixture.')
    await channelCard.getByLabel('Official policy assessment').selectOption('pass')
    await channelCard.getByLabel('Official policy URL').fill('https://example.com/e2e-channel-policy-fixture')
    await channelCard.getByLabel('Policy checked at').fill(localDateTime(-60_000))
    await channelCard.getByLabel('Manual fallback').fill('CI test only: an operator would manually upload and then record a real provider receipt.')
    await channelCard.getByRole('button', { name: 'Save evidence review' }).click()
    await page.getByRole('status').filter({ hasText: 'C1 manual listing package enabled. No API publishing is authorized.' }).waitFor()

    const listingForm = page.locator('form').filter({ has: page.getByLabel('Listing title') }).first()
    await listingForm.waitFor()
    await listingForm.getByLabel('Listing title').fill(title)
    await listingForm.getByLabel('Tags (comma separated)').fill('e2e,fixture,digital-utility')
    await listingForm.getByLabel('Description').fill('Synthetic manual listing package used only to verify validation and persistence in the isolated CI database.')
    await listingForm.getByLabel('Price (minor units)').fill('25000')
    await listingForm.getByLabel('Currency').fill('IDR')
    await listingForm.getByLabel('Required disclosures (one per line)').fill('Synthetic CI fixture; not a real offer or sale.')
    await listingForm.getByLabel('Manual upload instructions').fill('Do not upload or publish. This listing package exists only in the isolated browser E2E database.')
    await listingForm.getByRole('button', { name: 'Prepare manual listing package' }).click()
    await page.getByRole('status').filter({ hasText: `Manual listing package ready for ${channelName}. Nothing has been published automatically.` }).waitFor()
    const listingCard = page.locator('article').filter({ hasText: title }).filter({ hasText: channelName }).first()
    await listingCard.getByText('READY', { exact: true }).waitFor()

    // Persist and reconcile test financial events. These are synthetic CI fixtures,
    // not actual sales, receipts, tax payments, or income.
    await page.goto(`${baseUrl}/mizan-ledger`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'MIZAN LEDGER' }).waitFor()
    const ledgerForm = page.locator('form').filter({ has: page.getByLabel('Event type') }).first()

    async function recordAndVerifyEvent({ type, amount, source, reference, evidenceUrl, rationale }) {
      await ledgerForm.getByLabel('Event type').selectOption(type)
      await ledgerForm.getByLabel('Product (optional)').selectOption({ label: `${title} · v1` })
      await ledgerForm.getByLabel('Amount · minor units').fill(amount)
      await ledgerForm.getByLabel('ISO currency').fill('IDR')
      await ledgerForm.getByLabel('Occurred at').fill(localDateTime(-30_000))
      await ledgerForm.getByLabel('Source').fill(source)
      await ledgerForm.getByLabel('Provider reference (optional)').fill(reference)
      await ledgerForm.getByRole('button', { name: 'Record pending financial event' }).click()
      await page.getByRole('status').filter({ hasText: 'Financial event recorded as pending reconciliation.' }).waitFor()

      const eventCard = page.locator('article').filter({ hasText: source }).first()
      await eventCard.waitFor()
      await eventCard.getByLabel('Evidence URL').fill(evidenceUrl)
      await eventCard.getByLabel('Reconciliation rationale').fill(rationale)
      await eventCard.getByRole('button', { name: 'Save reconciliation' }).click()
      await eventCard.getByText('verified', { exact: true }).waitFor()
    }

    await recordAndVerifyEvent({
      type: 'gross-receipt',
      amount: '5000',
      source: `CI-only gross receipt fixture ${runId}`,
      reference: `e2e-gross-${runId}`,
      evidenceUrl: `https://example.com/e2e-gross-fixture-${runId}`,
      rationale: 'Synthetic CI-only event used to verify idempotent persistence and reconciliation; not an actual sale.',
    })
    await recordAndVerifyEvent({
      type: 'tax-reserve',
      amount: '300',
      source: `CI-only tax reserve fixture ${runId}`,
      reference: `e2e-tax-${runId}`,
      evidenceUrl: `https://example.com/e2e-tax-fixture-${runId}`,
      rationale: 'Synthetic CI-only reserve event used to verify separate accounting; not a tax payment.',
    })

    const summaryResponse = await context.request.get(`${baseUrl}/api/financial-summary`)
    assert.equal(summaryResponse.status(), 200)
    const summaryPayload = await summaryResponse.json()
    const idr = summaryPayload.data.find((row) => row.currency === 'IDR')
    assert.ok(idr)
    assert.equal(idr.gross_receipts_minor, '5000')
    assert.equal(idr.deductions_minor, '0')
    assert.equal(idr.tax_reserve_minor, '300')
    assert.equal(idr.net_contribution_minor, '5000')
    assert.equal(idr.pending_minor, '0')

    await page.goto(`${baseUrl}/aftershock`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'AFTERSHOCK' }).waitFor()
    await page.getByText('Net contribution · before tax reserve and payouts', { exact: true }).waitFor()
    await page.getByText('Tax reserve · verified', { exact: true }).waitFor()
    await page.getByText('5000', { exact: true }).first().waitFor()
    await page.getByText('300', { exact: true }).waitFor()

    // Version history is a real owner-scoped read path; stale writes must not fork from old briefs.
    await page.goto(`${baseUrl}/the-forge`, { waitUntil: 'domcontentloaded' })
    const productResponse = await context.request.get(`${baseUrl}/api/products?limit=100`)
    assert.equal(productResponse.status(), 200)
    const productPayload = await productResponse.json()
    const versionedProduct = productPayload.data.find((product) => product.title === title)
    assert.ok(versionedProduct)

    const versionedProductCard = page.locator('article').filter({ hasText: title }).first()
    const revisionDetails = versionedProductCard.locator('details').filter({ hasText: 'Create next version' })
    await revisionDetails.locator('summary').click()
    const revisionNotes = revisionDetails.getByPlaceholder('Describe what changes in this revision')
    await revisionNotes.waitFor({ state: 'visible' })
    await revisionNotes.fill('Add a reviewable immutable version history to the product brief.')
    await versionedProductCard.getByRole('button', { name: 'Create v2' }).click()
    await page.getByRole('status').filter({ hasText: 'New immutable product version created: v2' }).waitFor()
    await versionedProductCard.getByRole('button', { name: `Load version history for ${title}` }).click()
    await versionedProductCard.getByText('Version 2', { exact: false }).waitFor()
    await versionedProductCard.getByText('Version 1', { exact: false }).waitFor()

    const historyResponse = await context.request.get(`${baseUrl}/api/products/${versionedProduct.id}/versions`)
    assert.equal(historyResponse.status(), 200)
    const historyPayload = await historyResponse.json()
    assert.deepEqual(historyPayload.data.map((version) => version.version), [2, 1])
    assert.equal(historyPayload.data[1].brief.buyerProblem, versionedProduct.brief.buyerProblem)

    const staleVersionWrite = await context.request.post(`${baseUrl}/api/products/${versionedProduct.id}/versions`, {
      headers: { origin: new URL(baseUrl).origin },
      data: {
        expectedVersion: 1,
        brief: { ...versionedProduct.brief, buyerProblem: 'A stale version must not overwrite the latest product brief.' },
        acceptanceCriteria: versionedProduct.acceptanceCriteria,
      },
    })
    assert.equal(staleVersionWrite.status(), 409)
    assert.equal((await staleVersionWrite.json()).error.code, 'VERSION_CONFLICT')

    // Explicit sign-out clears the cookie and revokes access to protected API routes.
    await page.goto(`${baseUrl}/the-forge`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 15_000 })
    const afterLogout = await context.request.get(`${baseUrl}/api/opportunities?limit=100`)
    assert.equal(afterLogout.status(), 401)

    const anonymousPage = await browser.newPage()
    await anonymousPage.goto(`${baseUrl}/riot-radar`, { waitUntil: 'domcontentloaded' })
    await anonymousPage.getByLabel('Operator password').waitFor()
    assert.equal(await anonymousPage.getByRole('heading', { name: title, exact: true }).count(), 0)
    await anonymousPage.close()
    await context.close()

    assert.deepEqual(pageErrors, [], `Unexpected browser page errors: ${pageErrors.join('; ')}`)
  } finally {
    await browser.close()
  }
})
