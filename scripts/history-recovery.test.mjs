import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('recovery refresh dependencies remain stable and invalidated notices disable their action', async t => {
  // Capture the component's real effect dependencies without a browser. React compares
  // dependencies with Object.is; no DOM/screen-reader behavior is claimed by this test.
  const compiled = await build({
    stdin: { contents: `
      import { RecentlyDeleted, UndoHistory } from './src/history-recovery.tsx'
      import { removedHistory } from '../src/panel/history-recovery.ts'
      import { historyRaw } from '../src/panel/state.ts'
      import { set } from '../src/runtime.ts'
      import { effects } from 'recovery-hook-fixture'
      export function run() {
        set(historyRaw, [])
        RecentlyDeleted(); const before = effects.splice(0)
        const expiresAt = Date.now()+60000
        set(removedHistory, [{ id: 'one', label: 'One', expiresAt }])
        RecentlyDeleted(); const after = effects.splice(0)
        const props = { id: 'one', expiresAt }
        const active = UndoHistory(props).props
        set(removedHistory, [])
        const cleared = UndoHistory(props).props
        return { before, after, active, cleared }
      }`, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{ name: 'capture-recovery-hooks', setup(b) {
      b.onResolve({ filter: /^(react|recovery-hook-fixture)$/ }, args => args.path === 'recovery-hook-fixture' || /history-recovery\.tsx$/.test(args.importer) ? { path: 'fixture', namespace: 'hooks' } : undefined)
      b.onLoad({ filter: /.*/, namespace: 'hooks' }, () => ({ contents: 'export const effects=[]; export const useEffect=(fn,deps)=>effects.push(deps); export const useState=value=>[typeof value === "function" ? value() : value,()=>{}]; export const useSyncExternalStore=(_,get)=>get();' }))
    } }]
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const { before, after, active, cleared } = module.exports.run()
  await t.test('stable dependencies', () => {
    assert.equal(before.length, after.length)
    for (let i = 0; i < before.length; i++) {
      assert.equal(before[i].length, after[i].length)
      for (let j = 0; j < before[i].length; j++) assert.ok(Object.is(before[i][j], after[i][j]), 'a recovery response must not trigger another refresh effect')
    }
  })
  await t.test('invalidated notice', () => {
    assert.equal(active.disabled, false)
    assert.equal(cleared.disabled, true, 'Clear or another successful Undo invalidates old toast buttons')
  })
})
