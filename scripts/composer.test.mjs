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
    assert.doesNotMatch(html, /Or start a new agent|aria-label="Model"|Enter to enhance|Shift\+Enter for a new line/)
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


test('settings and model setup expose only supported Copilot controls', async () => {
  const compiled = await build({
    stdin: { contents: `
      import React from 'react'
      import { renderToStaticMarkup } from 'react-dom/server'
      import { SettingsSection, ModelsSection, RulesSection } from './src/sections.tsx'
      import { TooltipProvider } from './src/components/ui/tooltip.tsx'
      import { set } from '../src/runtime.ts'
      import { models, form, catalogs, dataSummary } from '../src/panel/state.ts'
      export function render(editing = false, unavailableSelector = false) {
        set(models, { profiles: [], selectorProfileId: unavailableSelector ? 'retired' : null })
        set(dataSummary, { history: 0, profiles: 0, catalogs: 0 })
        set(catalogs, { form: { models: [{ id: 'gpt-5', label: 'GPT-5' }], source: 'copilot', fetchedAt: 1 } })
        set(form, editing ? { name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5', enabled: true } : null)
        return renderToStaticMarkup(React.createElement(TooltipProvider, null,
          React.createElement(SettingsSection), React.createElement(ModelsSection), React.createElement(RulesSection)))
      }
    `, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  for (const editing of [false, true]) {
    const html = module.exports.render(editing)
    assert.doesNotMatch(html, /Start new agents|Auto-enhance|Notify when|Ask for feedback|API key|API format|Max tokens|external provider|aria-label="Preset"/i)
    for (const label of ['Effort models', 'Feedback', 'Open an issue on GitHub', 'Send right after enhancing']) assert.ok(html.includes(label), label)
    assert.match(html, /Copilot/)
    if (!editing) assert.match(html, /Select a Copilot model/)
  }
  const retired = module.exports.render(false, true)
  assert.match(retired, /saved file picker model is unavailable/)
  assert.match(retired, /aria-label="File picker model/)
})
