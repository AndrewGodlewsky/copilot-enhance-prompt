import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('composer exposes three choices and leaves request textarea Enter keys to native editing', async () => {
  const compiled = await build({
    stdin: { contents: `
      import React from 'react'
      import { renderToStaticMarkup } from 'react-dom/server'
      import { EnhanceSection } from './src/enhance.tsx'
      import { TooltipProvider } from './src/components/ui/tooltip.tsx'
      import { captured } from './src/components/ui/textarea.tsx'
      import { set } from '../src/runtime.ts'
      import { optionsOpen, result, draft, busy, run } from '../src/panel/state.ts'
      import { testCrew } from './src/use-word-crew.ts'
      export function render(open, working = false, finishing = false) {
        testCrew.finishing = finishing
        testCrew.visible = finishing
        set(run, finishing ? { runId: 'test', status: 'done', startedAt: 0, finishedAt: 1000, endPercent: 100, steps: [] } : null)
        set(busy, working ? 'enhance' : null)
        captured.length = 0
        set(optionsOpen, open)
        set(draft, 'A multiline request')
        set(result, 'An existing result')
        const html = renderToStaticMarkup(React.createElement(TooltipProvider, null,
          React.createElement(EnhanceSection, { refresh() {} })))
        return { html, inputs: captured }
      }
    `, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) },
    plugins: [{ name: 'capture-textarea-props', setup(build) {
      build.onLoad({ filter: /use-word-crew\.ts$/ }, () => ({
        contents: `export const testCrew = { input: {current:null}, scene: {current:null}, visible:false, finishing:false, paused:false, togglePause(){} }; export const useWordCrew = () => testCrew;`
      }))
      build.onLoad({ filter: /components[\\/]ui[\\/]textarea\.tsx$/ }, () => ({
        contents: `import React from 'react'; export const captured = []; export function Textarea(props) { captured.push(props); return React.createElement('textarea', props) }`, loader: 'tsx'
      }))
    } }],
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  for (const open of [false, true]) {
    const { html, inputs } = module.exports.render(open)
    for (const label of ['Context Level', 'Style', 'Effort']) {
      assert.equal((html.match(new RegExp(`aria-label="${label}"`, 'g')) ?? []).length, 1)
    }
    assert.doesNotMatch(html, /aria-label="Model"|Enter to enhance|Shift\+Enter for a new line/)
    const request = inputs.find(input => input['aria-label'] === 'Your prompt')
    assert.ok(request)
    assert.equal(request.onKeyDown, undefined, 'plain, modified and IME Enter never trigger an action')
    assert.equal(request.onKeyPress, undefined)
    assert.equal(request.onKeyUp, undefined)
    assert.equal(request.readOnly, false)
    assert.match(request.className, /\bpt-5\b/, 'reserve room for lifted first-line words without changing line spacing')
    const locked = module.exports.render(open, true).inputs.find(input => input['aria-label'] === 'Your prompt')
    assert.equal(locked.readOnly, true, 'request editing is locked for the real enhancement run')
    const ending = module.exports.render(open, false, true)
    assert.match(ending.html, /100%/)
    assert.match(ending.html, /Prompt ready/)
    assert.doesNotMatch(ending.html, />Try again<|>Dismiss</, 'success must not expose retry actions during the completion lock')
    assert.equal(ending.inputs.find(input => input['aria-label'] === 'Your prompt').readOnly, true)
    assert.match(html, />Enhance</)
    assert.ok(inputs.some(input => input !== request && typeof input.onKeyDown === 'function'), 'reviewed-result send shortcut remains')
  }
})
