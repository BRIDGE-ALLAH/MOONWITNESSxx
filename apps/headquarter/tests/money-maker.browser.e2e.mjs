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

test('operator can create and reload a persisted opportunity; anonymous visitors cannot read it', {
  timeout: 120_000,
}, async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const title = `Browser E2E persistence fixture ${Date.now()}`

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Operator password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Enter Headquarter' }).click()
    await page.waitForURL('**/riot-radar')
    await page.getByRole('heading', { name: 'RIOT RADAR' }).waitFor()

    await page.getByLabel('Opportunity title').fill(title)
    await page.getByLabel('Buyer segment').fill('Isolated browser test operators')
    await page.getByLabel('Buyer problem').fill('Operators need proof that an opportunity survives browser reloads and backend restarts.')
    await page.getByLabel('Job to be done').fill('Save a source-backed opportunity and retrieve it in a fresh page load.')
    await page.getByLabel('Product hypothesis').fill('A persisted opportunity register keeps operator research available across sessions.')
    await page.getByLabel('Source name').fill('MOONWITNESS isolated browser E2E fixture')
    await page.getByLabel('Canonical source URL').fill('https://example.com/moonwitness-browser-e2e-fixture')
    await page.getByLabel('Collection method').fill('Synthetic Playwright browser test fixture.')
    await page.getByLabel('Permission basis').fill('Test-only placeholder URL; no external market claim is asserted.')
    await page.getByLabel('Evidence summary').fill('Synthetic evidence record used only to verify the browser-to-PostgreSQL persistence path.')
    await page.getByLabel('Limitations').fill('This fixture does not establish market demand, licensing, or provider eligibility.')

    await page.getByRole('button', { name: 'Save evidence-backed opportunity' }).click()
    await page.getByRole('status').filter({ hasText: 'Opportunity saved.' }).waitFor()
    await page.getByRole('heading', { name: title, exact: true }).waitFor()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'RIOT RADAR' }).waitFor()
    await page.getByRole('heading', { name: title, exact: true }).waitFor()

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
