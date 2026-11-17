import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('Settings renders a default-checked enhanced prompt checkbox with a label and fallback explanation', async () => {
  const compiled = await build({ stdin: {
    contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
      import { Preferences } from './src/preferences.tsx'; import { bindPanel } from '../src/runtime.ts';
      bindPanel({});
      export const render = () => renderToStaticMarkup(React.createElement(Preferences));`,
    resolveDir: fileURLToPath(new URL('../web/', import.meta.url))
  }, tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const html = module.exports.render()
  const checkbox = html.match(/<button\b[^>]*id="use-enhanced-prompts"[^>]*>/)?.[0]
  assert.ok(checkbox)
  assert.match(checkbox, /role="checkbox"/)
  assert.match(checkbox, /aria-checked="true"/)
  assert.match(checkbox, /aria-describedby="enhanced-prompts-help"/)
  assert.match(html, /<label[^>]*for="use-enhanced-prompts"[^>]*>Use enhanced prompts<\/label>/)
  assert.match(html, /Uncheck to use the original prompts\. Applies to the next enhancement\./)
})
