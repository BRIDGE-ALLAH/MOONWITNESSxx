import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE_PATH
const baseUrl = process.env.HEADQUARTER_E2E_URL ?? 'http://127.0.0.1:3000'
const operatorPassword = process.env.HEADQUARTER_OPERATOR_PASSWORD

if (!playwrightPath) throw new Error('PLAYWRIGHT_PACKAGE_PATH must point to the isolated Playwright installation.')
if (!operatorPassword) throw new Error('HEADQUARTER_OPERATOR_PASSWORD must be configured for the isolated E2E runtime.')

const { chromium } = require(playwrightPath)

test('operator completes opportunity-to-ready-product workflow; anonymous visitors cannot read records', {
  timeout: 180_000,
}, async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const title = `Browser E2E product fixture ${Date.now()}`

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Operator password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Enter Headquarter' }).click()
    await page.waitForURL('**/riot-radar')
    await page.getByRole('heading', { name: 'RIOT RADAR' }).waitFor()

    await page.getByLabel('Opportunity title').fill(title)
    await page.getByLabel('Buyer segment').fill('Isolated browser test operators')
    await page.getByLabel('Buyer problem').fill('Operators need proof that an evidence-backed opportunity becomes a persisted product through the real application.')
    await page.getByLabel('Job to be done').fill('Create a test-only opportunity and carry it through product quality review.')
    await page.getByLabel('Product hypothesis').fill('A persisted opportunity can be promoted to a versioned product brief after all hard gates pass.')
    await page.getByLabel('Source name').fill('MOONWITNESS isolated browser E2E fixture')
    await page.getByLabel('Canonical source URL').fill('https://example.com/moonwitness-browser-e2e-fixture')
    await page.getByLabel('Collection method').fill('Synthetic Playwright browser test fixture.')
    await page.getByLabel('Permission basis').fill('Test-only placeholder URL; no external market claim is asserted.')
    await page.getByLabel('Evidence summary').fill('Synthetic evidence record used only to verify browser-to-PostgreSQL persistence and business logic.')
    await page.getByLabel('Limitations').fill('This fixture does not establish market demand, licensing, country eligibility, or provider approval.')

    const scores = [
      ['demandEvidence', 'Demand evidence', 24],
      ['competitionGap', 'Competition / quality gap', 19],
      ['usefulnessDifferentiation', 'Usefulness / differentiation', 14],
      ['marketplaceFit', 'Marketplace / buyer-intent fit', 13],
      ['productionFeasibility', 'Production feasibility', 9],
      ['durability', 'Durability / repeat demand', 9],
      ['distributionReadiness', 'Distribution readiness', 4],
    ]
    for (const [key, label, value] of scores) {
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

    await page.goto(`${baseUrl}/the-forge`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'THE FORGE' }).waitFor()
    await page.getByLabel('Acceptance criteria').fill('Persists the product brief in PostgreSQL\nKeeps the opportunity and evidence provenance linked')
    await page.getByRole('button', { name: 'Create version 1 product brief' }).click()
    await page.getByRole('status').filter({ hasText: `Product brief created: ${title}` }).waitFor()

    await page.getByLabel(`Lifecycle state for ${title}`).selectOption('production')
    await page.getByRole('status').filter({ hasText: `Product lifecycle updated: ${title} · production` }).waitFor()

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
        ? 'All four latest inspections pass. Product lifecycle is READY.'
        : 'Inspection recorded. Product remains in REVIEW until all four latest inspections pass.'
      await page.getByRole('status').filter({ hasText: expectedMessage }).waitFor()
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'ZILL WATCH' }).waitFor()
    const readyCard = page.locator('article').filter({ hasText: title }).first()
    await readyCard.getByText('4/4 PASSED').waitFor()
    await readyCard.getByText('Version 1 · ready').waitFor()

    const anonymousPage = await browser.newPage()
    await anonymousPage.goto(`${baseUrl}/riot-radar`, { waitUntil: 'domcontentloaded' })
    await anonymousPage.getByLabel('Operator password').waitFor()
    assert.equal(await anonymousPage.getByRole('heading', { name: title, exact: true }).count(), 0)
    await anonymousPage.close()
    await context.close()
  } finally {
    await browser.close()
  }
})
