import test from 'node:test'
import assert from 'node:assert/strict'

function resetGlobals() {
  delete globalThis.window
}

test('tauri lib', async (t) => {
  await t.test('isTauri returns false when window is undefined', () => {
    resetGlobals()
    return import('../src/lib/tauri.ts').then(({ isTauri }) => {
      assert.equal(isTauri(), false)
    })
  })

  await t.test('isTauri returns false when window exists without __TAURI__', async () => {
    globalThis.window = {}
    const { isTauri } = await import(`../src/lib/tauri.ts?nocache=${Date.now()}`)
    assert.equal(isTauri(), false)
    resetGlobals()
  })

  await t.test('isTauri returns true when window.__TAURI__ is present', async () => {
    globalThis.window = { __TAURI__: { invoke: async () => null } }
    const { isTauri } = await import(`../src/lib/tauri.ts?tauri=${Date.now()}`)
    assert.equal(isTauri(), true)
    resetGlobals()
  })

  await t.test('invoke throws not-tauri outside Tauri', async () => {
    resetGlobals()
    const { invoke } = await import(`../src/lib/tauri.ts?inv1=${Date.now()}`)
    await assert.rejects(() => invoke('any_cmd'), /not-tauri/)
  })

  await t.test('invoke delegates to window.__TAURI__.invoke in Tauri', async () => {
    const calls = []
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd, args) => {
          calls.push([cmd, args])
          return { ok: true, cmd }
        },
      },
    }
    const { invoke } = await import(`../src/lib/tauri.ts?inv2=${Date.now()}`)
    const result = await invoke('my_cmd', { a: 1 })
    assert.deepEqual(calls, [['my_cmd', { a: 1 }]])
    assert.deepEqual(result, { ok: true, cmd: 'my_cmd' })
    resetGlobals()
  })
})
