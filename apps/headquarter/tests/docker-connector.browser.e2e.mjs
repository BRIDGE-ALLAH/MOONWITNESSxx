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

test('operator registers a real Docker Engine and reads persisted inventory through Headquarter', {
  timeout: 180_000,
}, async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(`${baseUrl}/login?returnTo=%2Finfrastructure%2Fdocker`, { waitUntil: 'domcontentloaded' })
    // Next.js client handlers must be hydrated before submitting; otherwise the
    // browser falls back to a native GET form submission and drops the returnTo.
    await page.waitForLoadState('networkidle')
    await page.getByTestId('operator-login-form').waitFor()
    await page.getByLabel('Operator password').fill(operatorPassword)
    await page.getByRole('button', { name: 'Enter Headquarter' }).click()
    await page.waitForURL('**/infrastructure/docker')
    await page.getByRole('heading', { name: 'Docker Connector' }).waitFor()

    await page.getByLabel('Name').fill('CI Docker Engine')
    await page.getByRole('button', { name: 'Test & register' }).click()
    await page.getByText('CI Docker Engine', { exact: true }).waitFor({ timeout: 30_000 })

    const waitForEngineVersion = async () => {
      const value = page.getByText('Engine', { exact: true }).locator('xpath=..').locator('p').nth(1)
      await value.waitFor({ state: 'visible', timeout: 30_000 })
      const handle = await value.elementHandle()
      await page.waitForFunction(
        (element) => /^\d+\.\d+/.test(element?.textContent?.trim() ?? ''),
        handle,
        { timeout: 30_000 },
      )
      return value
    }
    const engineValue = await waitForEngineVersion()
    assert.match((await engineValue.textContent()) ?? '', /^\d+\.\d+/,
      'Headquarter must render the version returned by the real Docker Engine API')

    // The PostgreSQL service started by this workflow is itself a real container
    // visible to the runner Docker daemon, so the UI must show real inventory.
    const monitorButtons = page.getByRole('button', { name: 'Monitor', exact: true })
    await monitorButtons.first().waitFor({ timeout: 30_000 })
    await monitorButtons.first().click()
    await page.getByRole('heading', { name: 'Runtime telemetry' }).waitFor({ timeout: 30_000 })
    await page.getByText(/Observed by Docker Engine:/).waitFor({ timeout: 30_000 })

    const logButtons = page.getByRole('button', { name: 'Logs', exact: true })
    await logButtons.first().waitFor({ timeout: 30_000 })
    await logButtons.first().click()
    await page.getByRole('heading', { name: 'Container logs' }).waitFor({ timeout: 30_000 })

    // A full browser reload must recover the connection from PostgreSQL and
    // re-query Engine state; no component-only state may be required.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Docker Connector' }).waitFor()
    await page.getByText('CI Docker Engine', { exact: true }).waitFor({ timeout: 30_000 })
    const refreshedEngineValue = await waitForEngineVersion()
    assert.match((await refreshedEngineValue.textContent()) ?? '', /^\d+\.\d+/)
    await page.getByRole('button', { name: 'Logs', exact: true }).first().waitFor({ timeout: 30_000 })

    assert.deepEqual(pageErrors, [], 'the Docker workflow must not produce uncaught browser errors')
    await context.close()
  } finally {
    await browser.close()
  }
})
