import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(directory, '..')

test('RIOT RELEASE remains an offline-first COCKPIT workspace', async (t) => {
  const rustPath = path.join(appRoot, 'src-tauri/src/riot_release.rs')
  const mainPath = path.join(appRoot, 'src-tauri/src/main.rs')
  const clientPath = path.join(appRoot, 'src/lib/riotRelease.ts')
  const uiPath = path.join(appRoot, 'src/components/RiotReleaseWorkspace.tsx')
  const routePath = path.join(appRoot, 'src/app/release/page.tsx')
  const rust = fs.readFileSync(rustPath, 'utf-8')
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
    assert.match(ui, /not pushed or published/)
    assert.match(ui, /Desktop runtime required/)
    assert.match(client, /requireDesktop/)
  })
})
