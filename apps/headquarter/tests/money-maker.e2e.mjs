import assert from 'node:assert/strict'

const playwrightModule = process.env.PLAYWRIGHT_MODULE
if (!playwrightModule) throw new Error('PLAYWRIGHT_MODULE must point to the installed Playwright ESM entry.')
const { chromium } = await import(playwrightModule)
const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
const password = process.env.HEADQUARTER_OPERATOR_PASSWORD
if (!password) throw new Error('HEADQUARTER_OPERATOR_PASSWORD is required for the isolated E2E environment.')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ ignoreHTTPSErrors: true })
const page = await context.newPage()
const runId = `e2e-${Date.now()}`
const title = `Persisted commerce workflow ${runId}`
const source = `Isolated CI statement ${runId}`
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

try {
  // Anonymous users cannot read operator records.
  const anonymous = await context.request.get(`${baseUrl}/api/opportunities?limit=100`)
  assert.equal(anonymous.status(), 401)

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Operator password').fill(password)
  await page.getByRole('button', { name: 'Enter Headquarter' }).click()
  await page.waitForURL((url) => url.pathname === '/riot-radar', { timeout: 30_000 })
  await page.getByTestId('opportunity-form').waitFor({ state: 'visible' })

  // Create a fully evidenced, operator-assessed opportunity through the real UI.
  await page.getByLabel('Opportunity title').fill(title)
  await page.getByLabel('Buyer segment').fill('Small independent ecommerce operators')
  await page.getByLabel('Buyer problem').fill('Inventory counts drift between channels and operators discover discrepancies only after an order fails.')
  await page.getByLabel('Job to be done').fill('Keep inventory counts consistent across active sales channels.')
  await page.getByLabel('Product hypothesis').fill('A lightweight reconciliation utility can identify stock discrepancies before orders are accepted.')
  await page.getByLabel('Candidate channels').fill('Direct operator workflow')
  await page.getByLabel('Source name').fill('Playwright isolated evidence fixture')
  await page.getByLabel('Canonical source URL').fill('https://example.com/isolated-ci-evidence')
  await page.getByLabel('Collection method').fill('Isolated Playwright end-to-end fixture')
  await page.getByLabel('Permission basis').fill('Public example URL used only as non-production test data.')
  await page.getByLabel('Evidence summary').fill('This fixture validates persistence and workflow wiring only; it is not market research.')
  await page.getByLabel('Limitations').fill('No real demand, conversion, revenue, or market validation is inferred from this test.')

  const dimensions = [
    ['Demand evidence', 20],
    ['Competition / quality gap', 16],
    ['Usefulness / differentiation', 12],
    ['Marketplace / buyer-intent fit', 12],
    ['Production feasibility', 8],
    ['Durability / repeat demand', 8],
    ['Distribution readiness', 4],
  ]
  for (const [label, score] of dimensions) {
    await page.getByLabel(`${label} score`).fill(String(score))
    await page.getByLabel(`${label} rationale`).fill('Deterministic test rationale; not a real market claim.')
    await page.getByLabel(`${label} confidence`).selectOption('high')
  }

  for (const label of ['Rights & licensing', 'Country eligibility', 'Channel policy', 'Payout feasibility']) {
    await page.getByLabel(`${label} hard gate`).selectOption('pass')
    await page.getByLabel(`${label} gate rationale`).fill('Operator-assessed test fixture only; no external verification is implied.')
  }

  await page.getByTestId('save-opportunity').click()
  const opportunityCard = page.getByTestId('opportunity-card').filter({ hasText: title })
  await opportunityCard.waitFor({ state: 'visible', timeout: 30_000 })

  // Review source provenance, score rationale and hard gates; then persist an optimistic edit.
  await opportunityCard.locator('details').first().locator('summary').click()
  await opportunityCard.getByText('Playwright isolated evidence fixture').waitFor({ state: 'visible' })
  await opportunityCard.getByRole('button', { name: 'Edit opportunity record' }).click()
  await opportunityCard.getByLabel('Buyer problem').fill('Inventory counts drift between channels and operators discover discrepancies before orders fail.')
  await opportunityCard.getByRole('button', { name: 'Save revision' }).click()
  await page.getByRole('status').filter({ hasText: 'Opportunity updated to revision' }).waitFor({ state: 'visible' })

  // Exercise the actual decision endpoint and its audit-producing workflow.
  await opportunityCard.getByLabel(`Decision for ${title}`).selectOption('research-more')
  await opportunityCard.getByLabel(`Decision rationale for ${title}`).fill('Wait for an independent source before product promotion.')
  await opportunityCard.getByRole('button', { name: 'Save decision' }).click()
  await page.getByRole('status').filter({ hasText: 'Decision updated and recorded' }).waitFor({ state: 'visible' })

  await opportunityCard.getByLabel(`Decision for ${title}`).selectOption('prototype-candidate')
  await opportunityCard.getByLabel(`Decision rationale for ${title}`).fill('The isolated test now permits the product brief lifecycle check.')
  await opportunityCard.getByRole('button', { name: 'Save decision' }).click()
  await page.getByRole('status').filter({ hasText: 'Decision updated and recorded' }).waitFor({ state: 'visible' })

  // Promote the persisted opportunity into a real, versioned product brief.
  await page.goto(`${baseUrl}/the-forge`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel(`Acceptance criteria for ${title}`).fill('Imports source rows without loss.\nExports a reconciliation report with stable row identifiers.')
  await page.getByTestId('create-product-brief').click()
  await page.getByRole('status').filter({ hasText: 'Product brief created' }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByText(title, { exact: true }).waitFor({ state: 'visible' })

  // Product edits append a version; lifecycle transitions are explicit and audited.
  await page.getByText('Version history & edit brief').click()
  await page.getByLabel('Brief summary').fill('Version two: adds a documented reconciliation export.')
  await page.getByRole('button', { name: 'Create version 2' }).click()
  await page.getByRole('status').filter({ hasText: 'Created immutable version 2' }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByLabel('Lifecycle rationale').fill('The versioned brief is approved for implementation work.')
  await page.getByRole('button', { name: 'Start production' }).click()
  await page.getByRole('status').filter({ hasText: 'moved to production' }).waitFor({ state: 'visible', timeout: 30_000 })

  // Store a real asset binary with provenance and append source-qualified inspections.
  const productCard = page.locator('article').filter({ hasText: title }).first()
  await productCard.getByLabel('Asset file').setInputFiles({
    name: 'integration-source.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Isolated CI asset bytes; never a customer deliverable.'),
  })
  await productCard.getByLabel('Creator / owner').fill('Playwright isolated fixture author')
  await productCard.getByLabel('License').fill('Original test fixture')
  await productCard.getByLabel('Permission basis').fill('Generated inside the isolated CI workflow and not distributed.')
  await productCard.getByLabel('Disclosure').fill('Synthetic CI fixture; not a production asset.')
  await productCard.getByRole('button', { name: 'Store bytes & provenance' }).click()
  await page.getByRole('status').filter({ hasText: 'Asset bytes and provenance stored' }).waitFor({ state: 'visible', timeout: 30_000 })
  const assetCard = productCard.locator('article').filter({ hasText: 'integration-source.txt' })
  await assetCard.waitFor({ state: 'visible' })
  await assetCard.getByRole('link', { name: 'Download original' }).waitFor({ state: 'visible' })
  const inspections = [
    ['rights', 'Independent review (reported)'],
    ['policy', 'Independent review (reported)'],
    ['technical-qa', 'Automated check'],
    ['creative-qa', 'Independent review (reported)'],
  ]
  for (const [type, sourceType] of inspections) {
    await assetCard.locator('details').first().locator('summary').click()
    await assetCard.getByLabel('Inspection source').selectOption({ label: sourceType })
    await assetCard.getByLabel('Inspection type').selectOption(type)
    await assetCard.getByLabel('Status').selectOption('pass')
    await assetCard.getByLabel('Rationale').fill(`Isolated CI fixture records the ${type} inspection workflow.`)
    await assetCard.getByLabel('Evidence URL or reference').fill(`https://example.com/asset-inspection/${type}/${runId}`)
    await assetCard.getByRole('button', { name: 'Append inspection record' }).click()
    await page.getByRole('status').filter({ hasText: 'Inspection record appended' }).waitFor({ state: 'visible', timeout: 30_000 })
  }
  await assetCard.getByText('Not channel-ready: missing/blocked checks, self-attested records, or untrusted inspection actors.').waitFor({ state: 'visible', timeout: 30_000 })

  // Record a real pending ledger event and reconcile it with a source URL.
  await page.goto(`${baseUrl}/mizan-ledger`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Event type').selectOption('gross-receipt')
  await page.getByLabel('Product (optional)').selectOption({ label: `${title} · v2` })
  await page.getByLabel('Amount · minor units').fill('5000')
  await page.getByLabel('ISO currency').fill('IDR')
  await page.getByLabel('Occurred at').fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16))
  await page.getByLabel('Source', { exact: true }).fill(source)
  await page.getByLabel('Provider reference (optional)').fill(runId)
  await page.getByTestId('record-financial-event').click()
  await page.getByRole('status').filter({ hasText: 'Financial event recorded as pending reconciliation' }).waitFor({ state: 'visible', timeout: 30_000 })

  const eventCard = page.getByTestId('financial-event-card').filter({ hasText: source })
  await eventCard.waitFor({ state: 'visible' })
  await eventCard.getByLabel('Evidence URL').fill(`https://example.com/isolated-statement/${runId}`)
  await eventCard.getByLabel('Reconciliation rationale').fill('Matched to the isolated CI statement fixture.')
  await eventCard.getByTestId('save-reconciliation').click()
  await eventCard.getByText('verified', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })

  const summaryResponse = await context.request.get(`${baseUrl}/api/financial-summary`)
  assert.equal(summaryResponse.status(), 200)
  const summaryPayload = await summaryResponse.json()
  const idr = summaryPayload.data.find((row) => row.currency === 'IDR')
  assert.ok(idr)
  assert.equal(idr.gross_receipts_minor, '5000')
  assert.equal(idr.net_contribution_minor, '5000')
  assert.equal(idr.tax_reserve_minor, '0')
  assert.equal(idr.pending_minor, '0')

  // A verified tax reserve is reported separately and does not reduce operating contribution.
  await page.getByLabel('Event type').selectOption('tax-reserve')
  await page.getByLabel('Product (optional)').selectOption({ label: `${title} · v1` })
  await page.getByLabel('Amount · minor units').fill('300')
  await page.getByLabel('ISO currency').fill('IDR')
  await page.getByLabel('Occurred at').fill(new Date(Date.now() - 30_000).toISOString().slice(0, 16))
  await page.getByLabel('Source', { exact: true }).fill(`${source} tax reserve`)
  await page.getByLabel('Provider reference (optional)').fill(`${runId}-tax`)
  await page.getByTestId('record-financial-event').click()
  await page.getByRole('status').filter({ hasText: 'Financial event recorded as pending reconciliation' }).waitFor({ state: 'visible', timeout: 30_000 })
  const taxEventCard = page.getByTestId('financial-event-card').filter({ hasText: `${source} tax reserve` })
  await taxEventCard.waitFor({ state: 'visible' })
  await taxEventCard.getByLabel('Evidence URL').fill(`https://example.com/isolated-tax-statement/${runId}`)
  await taxEventCard.getByLabel('Reconciliation rationale').fill('Matched to the isolated CI tax-reserve statement fixture.')
  await taxEventCard.getByTestId('save-reconciliation').click()
  await taxEventCard.getByText('verified', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 })

  const updatedSummaryResponse = await context.request.get(`${baseUrl}/api/financial-summary`)
  assert.equal(updatedSummaryResponse.status(), 200)
  const updatedSummaryPayload = await updatedSummaryResponse.json()
  const updatedIdr = updatedSummaryPayload.data.find((row) => row.currency === 'IDR')
  assert.ok(updatedIdr)
  assert.equal(updatedIdr.gross_receipts_minor, '5000')
  assert.equal(updatedIdr.net_contribution_minor, '5000')
  assert.equal(updatedIdr.tax_reserve_minor, '300')
  assert.equal(updatedIdr.pending_minor, '0')

  // Refresh proves that all three layers are reading persisted data.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await eventCard.waitFor({ state: 'visible' })

  // Portfolio analytics must use persisted records and explicitly label unavailable cohorts.
  await page.goto(`${baseUrl}/aftershock`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Financial contribution by currency').waitFor({ state: 'visible' })
  await page.getByText('Net contribution (before tax reserve and payouts)', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Verified tax reserve', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('300', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('5000', { exact: true }).waitFor({ state: 'visible' })
  await page.getByText('Unavailable. Search impression and source-exposure events are not yet captured with a defined denominator.').waitFor({ state: 'visible' })

  // Archive is a real soft-delete; the audit record and related product/ledger remain.
  await page.goto(`${baseUrl}/riot-radar`, { waitUntil: 'domcontentloaded' })
  const archiveCard = page.getByTestId('opportunity-card').filter({ hasText: title })
  await archiveCard.waitFor({ state: 'visible' })
  page.once('dialog', (dialog) => dialog.accept())
  await archiveCard.getByTestId('archive-opportunity').click()
  await archiveCard.waitFor({ state: 'detached', timeout: 30_000 })

  const archivedList = await context.request.get(`${baseUrl}/api/opportunities?limit=100`)
  assert.equal(archivedList.status(), 200)
  const archivedPayload = await archivedList.json()
  assert.equal(archivedPayload.data.some((item) => item.title === title), false)

  const productList = await context.request.get(`${baseUrl}/api/products?limit=100`)
  assert.equal(productList.status(), 200)
  const productPayload = await productList.json()
  assert.equal(productPayload.data.some((item) => item.title === title), true)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 15_000 })
  const afterLogout = await context.request.get(`${baseUrl}/api/opportunities?limit=100`)
  assert.equal(afterLogout.status(), 401)

  assert.deepEqual(pageErrors, [], `Unexpected browser page errors: ${pageErrors.join('; ')}`)
  process.stdout.write('PASS: authenticated opportunity → decision → product brief → financial event → reconciliation → archive → logout workflow\n')
} finally {
  await browser.close()
}
