import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(directory, '..')

test('RIOT RELEASE remains an offline-first COCKPIT workspace', async (t) => {
  const rustPath = path.join(appRoot, 'src-tauri/src/riot_release.rs')
  const buildRustPath = path.join(appRoot, 'src-tauri/src/riot_release_build.rs')
  const mainPath = path.join(appRoot, 'src-tauri/src/main.rs')
  const clientPath = path.join(appRoot, 'src/lib/riotRelease.ts')
  const uiPath = path.join(appRoot, 'src/components/RiotReleaseWorkspace.tsx')
  const routePath = path.join(appRoot, 'src/app/release/page.tsx')
  const rust = fs.readFileSync(rustPath, 'utf-8')
  const buildRust = fs.readFileSync(buildRustPath, 'utf-8')
  const main = fs.readFileSync(mainPath, 'utf-8')
  const client = fs.readFileSync(clientPath, 'utf-8')
  const ui = fs.readFileSync(uiPath, 'utf-8')
  const route = fs.readFileSync(routePath, 'utf-8')

  await t.test('desktop commands are registered and use the Git executable without a shell', () => {
    for (const command of [
      'riot_release_add_repository',
      'riot_release_list_repositories',
      'riot_release_remove_repository',
      'riot_release_get_preview',
      'riot_release_save_draft',
      'riot_release_list_drafts',
      'riot_release_list_history',
      'riot_release_create_local_tag',
    ]) {
      assert.match(main, new RegExp('riot_release::' + command))
      assert.match(rust, new RegExp('fn ' + command))
    }
    assert.match(rust, /Command::new\("git"\)/)
    assert.match(rust, /\.args\(args\)/)
    assert.doesNotMatch(rust, /sh\s+-c|powershell\s+-command|cmd\.exe\s+\/c/i)
  })

  await t.test('tagging validates SemVer, requires a clean tree, and protects existing tags', () => {
    assert.match(rust, /fn normalize_tag/)
    assert.match(rust, /if !status\(&root\)\?\.clean/)
    assert.match(rust, /show-ref/)
    assert.match(rust, /will not be overwritten/)
    assert.match(rust, /--annotate/)
    assert.doesNotMatch(rust, /git push|push --force|git tag --delete/)
  })

  await t.test('registry, drafts, and history are stored in local app data', () => {
    assert.match(rust, /app_data_dir/)
    assert.match(rust, /repositories\.json/)
    assert.match(rust, /drafts\.json/)
    assert.match(rust, /history\.json/)
    assert.doesNotMatch(client + ui, /localStorage/)
  })

  await t.test('UI exposes the local-only boundary and desktop-only operation', () => {
    assert.match(route, /RiotReleaseWorkspace/)
    assert.match(ui, /NETWORK REQUIRED: NO/)
    assert.match(ui, /does not push, publish/)
    assert.match(ui, /Desktop runtime required/)
    assert.match(client, /requireDesktop/)
  })

  await t.test('Build Deck uses detected allowlisted profiles and explicit confirmation', () => {
    assert.match(main, /mod riot_release_build/)
    for (const command of [
      'riot_release_list_build_profiles',
      'riot_release_run_build',
      'riot_release_list_build_history',
      'riot_release_list_artifact_candidates',
      'riot_release_import_artifact',
      'riot_release_list_vault',
    ]) {
      assert.match(main, new RegExp('riot_release_build::' + command))
      assert.match(buildRust, new RegExp('fn ' + command))
    }
    assert.match(buildRust, /if !confirmed/)
    assert.match(buildRust, /detect_profiles/)
    assert.match(buildRust, /BUILD_TIMEOUT_SECS/)
    assert.match(buildRust, /kill_on_drop\(true\)/)
    assert.match(buildRust, /MAX_BUILD_LOG_BYTES/)
    assert.match(buildRust, /Command as TokioCommand/)
    assert.doesNotMatch(buildRust, /sh\s+-c|powershell\s+-command|cmd\.exe\s+\/c/i)
    assert.match(client, /runReleaseBuild/)
    assert.match(ui, /CONFIRM & RUN BUILD/)
    assert.match(ui, /repository-controlled code/)
  })

  await t.test('Artifact Vault restricts paths and records SHA-256 before import', () => {
    assert.match(buildRust, /symlink_metadata/)
    assert.match(buildRust, /is_allowed_artifact/)
    assert.match(buildRust, /sha256_file/)
    assert.match(buildRust, /Sha256::new/)
    assert.match(buildRust, /MAX_ARTIFACT_FILES/)
    assert.match(buildRust, /MAX_ARTIFACT_DEPTH/)
    assert.match(buildRust, /MAX_ARTIFACT_BYTES/)
    assert.match(buildRust, /copied_sha256 != sha256/)
    assert.match(client, /importReleaseArtifact/)
    assert.match(ui, /IMPORT TO LOCAL VAULT/)
    assert.match(ui, /SHA-256/)
  })
})
