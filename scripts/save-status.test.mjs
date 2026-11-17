import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('save status distinguishes queued, failed, acknowledged and privacy-disabled saves', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react'
    import {renderToStaticMarkup} from 'react-dom/server'
    import {SaveStatus} from './src/save-status.tsx'
    import {bindPanel, set} from '../src/runtime.ts'
    import {privacy} from '../src/panel/state.ts'
    export function render(phase, keep = true) {
      const state = {phase, pending: phase === 'saving' ? 1 : 0, failed: phase === 'failed' ? 1 : 0}
      bindPanel({persistence: {snapshot: () => state, subscribe: () => () => {}, retry: async () => {}}})
      set(privacy, {saveHistory: keep})
      return renderToStaticMarkup(React.createElement(SaveStatus))
    }`, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) }, tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' })
  const module = {exports: {}}
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  assert.match(module.exports.render('saving'), /Saving/)
  assert.doesNotMatch(module.exports.render('saving'), />Saved</)
  assert.match(module.exports.render('saved'), />Saved</)
  const failed = module.exports.render('failed')
  assert.match(failed, /role="status"/)
  assert.match(failed, /Retry save/)
  assert.match(failed, /Copy your text before closing/)
  assert.match(module.exports.render('saved', false), /Draft saving is off/)
  assert.doesNotMatch(module.exports.render('saved', false), />Saved</)
})
