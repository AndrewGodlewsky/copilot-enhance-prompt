import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('progress exposes its numeric value and completion state to assistive technology', async () => {
  const compiled = await build({
    stdin: { contents: `
      import React from 'react'
      import { renderToStaticMarkup } from 'react-dom/server'
      import { Progress } from './src/components/ui/progress.tsx'
      export const render = value => renderToStaticMarkup(React.createElement(Progress, { value, 'aria-label': 'Enhancing prompt' }))
    `, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  for (const value of [0, 50, 100]) {
    const html = module.exports.render(value)
    assert.match(html, /role="progressbar"/)
    assert.match(html, new RegExp(`aria-valuenow="${value}"`))
    assert.match(html, /aria-valuemin="0"/)
    assert.match(html, /aria-valuemax="100"/)
    assert.match(html, new RegExp(`data-state="${value === 100 ? 'complete' : 'loading'}"`))
  }
  assert.doesNotMatch(module.exports.render(undefined), /aria-valuenow=/)
  assert.match(module.exports.render(undefined), /data-state="indeterminate"/)
})
