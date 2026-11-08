import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

test('cockpit app contract & desktop runtime integrity', async (t) => {
  await t.test('package.json defines correct name and desktop script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf-8'))
    assert.equal(pkg.name, '@riotworks/cockpit')
    assert.ok(pkg.scripts.dev)
    assert.ok(pkg.scripts.desktop)
    assert.ok(pkg.scripts['type-check'])
  })

  await t.test('desktop rust runtime files exist', () => {
    assert.ok(fs.existsSync(path.join(appRoot, 'src-tauri/Cargo.toml')), 'Cargo.toml must exist')
    assert.ok(fs.existsSync(path.join(appRoot, 'src-tauri/src/main.rs')), 'Rust main.rs must exist')

    const cargoContent = fs.readFileSync(path.join(appRoot, 'src-tauri/Cargo.toml'), 'utf-8')
    assert.match(cargoContent, /moonwitness-cockpit/)
    assert.match(cargoContent, /tokio/)
  })

  await t.test('frontend NOC components exist and export valid contracts', () => {
    const gridPath = path.join(appRoot, 'src/components/ServiceNodeGrid.tsx')
    const actionPath = path.join(appRoot, 'src/components/ActionControlPanel.tsx')
    const pagePath = path.join(appRoot, 'src/app/page.tsx')

    assert.ok(fs.existsSync(gridPath), 'ServiceNodeGrid must exist')
    assert.ok(fs.existsSync(actionPath), 'ActionControlPanel must exist')
    assert.ok(fs.existsSync(pagePath), 'Cockpit page must exist')

    const gridContent = fs.readFileSync(gridPath, 'utf-8')
    assert.match(gridContent, /export function ServiceNodeGrid/)

    const actionContent = fs.readFileSync(actionPath, 'utf-8')
    assert.match(actionContent, /export function ActionControlPanel/)
  })

  await t.test('AGI copilot artifacts exist and export safe contracts', () => {
    const panelPath = path.join(appRoot, 'src/components/AgiCopilotPanel.tsx')
    const libPath = path.join(appRoot, 'src/lib/agiCopilot.ts')
    const copilotPath = path.join(appRoot, 'src/lib/copilot.ts')
    const pagePath = path.join(appRoot, 'src/app/page.tsx')
    const rustPath = path.join(appRoot, 'src-tauri/src/main.rs')
    const cargoPath = path.join(appRoot, 'src-tauri/Cargo.toml')
    const actionsPath = path.join(appRoot, 'src/lib/actions.ts')

    assert.ok(fs.existsSync(panelPath), 'AgiCopilotPanel must exist')
    assert.ok(fs.existsSync(libPath), 'agiCopilot lib must exist')
    assert.ok(fs.existsSync(copilotPath), 'copilot provider lib must exist')
    assert.ok(fs.existsSync(actionsPath), 'actions lib must exist')

    const panelContent = fs.readFileSync(panelPath, 'utf-8')
    assert.match(panelContent, /export function AgiCopilotPanel/)
    assert.match(panelContent, /AI Copilot \/ AGI Assist|AI Copilot/)
    assert.match(panelContent, /Confidence/)
    assert.match(panelContent, /Citations/)
    assert.match(panelContent, /analyzeCopilotProvider|local-heuristic|remote-llm/)

    const libContent = fs.readFileSync(libPath, 'utf-8')
    assert.match(libContent, /export function analyzeCopilot/)
    assert.match(libContent, /CockpitSnapshot/)
    assert.match(libContent, /provider/)

    const copilotContent = fs.readFileSync(copilotPath, 'utf-8')
    assert.match(copilotContent, /analyzeCopilotProvider/)
    assert.match(copilotContent, /remote-llm/)
    assert.match(copilotContent, /llm_analyze/)

    const pageContent = fs.readFileSync(pagePath, 'utf-8')
    assert.match(pageContent, /AgiCopilotPanel/)
    assert.match(pageContent, /AI Copilot/)
    assert.match(pageContent, /fetchCockpitTelemetry/)
    assert.match(pageContent, /ConfirmationDialog/)
    assert.match(pageContent, /AuditTrail/)
    assert.doesNotMatch(pageContent, /window\.confirm/, 'page must not use window.confirm')

    const rustContent = fs.readFileSync(rustPath, 'utf-8')
    const cargoContent = fs.readFileSync(cargoPath, 'utf-8')
    const actionsContent = fs.readFileSync(actionsPath, 'utf-8')
    assert.match(rustContent, /fn agi_analyze/)
    assert.match(rustContent, /agi_analyze/)
    assert.match(rustContent, /get_cockpit_telemetry/)
    assert.match(rustContent, /llm_analyze/)
    assert.match(rustContent, /keychain_get|keychain_set|keychain_delete/)
    assert.match(rustContent, /audit_append|audit_read/)
    // Governed read-only execution boundary (item #10): only DIAGNOSTIC_HEALTH_CHECK may
    // invoke real read-only Tauri diagnostic; command is allowlisted/registered.
    assert.match(rustContent, /run_diagnostic_health_check/)
    assert.match(rustContent, /DiagnosticResult|read-only diagnostic/i)
    assert.match(cargoContent, /sysinfo/, 'sysinfo used for read-only host/memory/process probe')
    assert.match(actionsContent, /executeGovernedDiagnostic/)
    assert.match(actionsContent, /DIAGNOSTIC_HEALTH_CHECK/, 'allowlist names diagnostic action')
    assert.match(actionsContent, /read-only-tauri/)
    assert.match(actionsContent, /intent-only/)
    // Strict allowlist assertion: only the DIAGNOSTIC_HEALTH_CHECK meta entry may be read-only-tauri.
    const roEntries = actionsContent.match(/realExecution:\s*'read-only-tauri'\s*,/g) ?? []
    assert.equal(roEntries.length, 1, 'exactly one action meta entry may be read-only-tauri')
    assert.match(
      actionsContent,
      /DIAGNOSTIC_HEALTH_CHECK[\s\S]{0,160}realExecution:\s*'read-only-tauri'/
    )
    assert.match(pageContent, /executeGovernedDiagnostic/)
    assert.match(pageContent, /isTauri\(\)/)
    assert.match(pageContent, /read-only-executed|intent-only/)
    assert.match(pageContent, /ConfirmationDialog/, 'confirm dialog gate preserved')
  })

  await t.test('new frontend artifacts exist', () => {
    for (const f of [
      'src/lib/tauri.ts',
      'src/lib/telemetry.ts',
      'src/lib/audit.ts',
      'src/lib/actions.ts',
      'src/lib/copilot.ts',
      'src/lib/envConfig.ts',
      'src/components/ConfirmationDialog.tsx',
      'src/components/AuditTrail.tsx',
    ]) {
      assert.ok(fs.existsSync(path.join(appRoot, f)), f)
    }
  })

  await t.test('frontend env SSoT aligns with Rust telemetry env config', () => {
    const envPath = path.join(appRoot, 'src/lib/envConfig.ts')
    const rustPath = path.join(appRoot, 'src-tauri/src/main.rs')
    assert.ok(fs.existsSync(envPath), 'envConfig SSoT must exist')
    const env = fs.readFileSync(envPath, 'utf-8')
    const rust = fs.readFileSync(rustPath, 'utf-8')

    // env ids preserved
    for (const id of ['local', 'development', 'production']) {
      assert.match(env, new RegExp(`'${id}'`), `frontend env id ${id}`)
      assert.match(rust, new RegExp(`"${id}"`), `rust env id ${id}`)
    }
    assert.match(env, /ENVIRONMENT_IDS/)
    assert.match(env, /DEFAULT_ENVIRONMENT/)

    // canonical node ids / expected targets mirrored
    for (const token of [
      'arsy',
      'oracle',
      'postgres',
      'radius',
      'ARSY CORE ORCHESTRATOR',
      'ORACLE PYTHON ENGINE',
      'POSTGRESQL PRIMARY CLUSTER',
      'ATLAS FREERADIUS RUNTIME',
      'http://localhost:4000/health/live',
      'http://localhost:8000/health/live',
      'localhost:5432',
      'localhost:1812',
    ]) {
      assert.ok(env.includes(token), `frontend envConfig missing token: ${token}`)
      assert.ok(rust.includes(token), `rust main.rs missing token: ${token}`)
    }

    // unknown env handling: frontend falls back safely; Rust returns Err/clear message
    assert.match(env, /resolveEnvironment|isEnvironmentTarget/)
    assert.match(env, /DEFAULT_ENVIRONMENT/)
    assert.match(rust, /unknown environment/)
    assert.match(rust, /expected local, development, or production/)

    // consumers use SSoT
    const telemetry = fs.readFileSync(path.join(appRoot, 'src/lib/telemetry.ts'), 'utf-8')
    const selector = fs.readFileSync(
      path.join(appRoot, 'src/components/EnvironmentSelector.tsx'),
      'utf-8'
    )
    assert.match(telemetry, /envConfig/)
    assert.match(selector, /envConfig/)
    assert.match(
      telemetry,
      /tcp probe unavailable in web/,
      'web TCP-unavailable messaging must remain truthful'
    )
  })
})
