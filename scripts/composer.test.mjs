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
      import { CopilotConnectionIndicator } from './src/copilot-connection.tsx'
      import { TooltipProvider } from './src/components/ui/tooltip.tsx'
      import { captured } from './src/components/ui/textarea.tsx'
      import { set } from '../src/runtime.ts'
      import { optionsOpen, result, draft, busy, run, catalogs, catalogLoading, copilotCheck, copilotDetailsOpen } from '../src/panel/state.ts'
      import { testCrew } from './src/use-word-crew.ts'
      export const indicator = () => CopilotConnectionIndicator()?.props
      export const redraw = () => renderToStaticMarkup(React.createElement(TooltipProvider, null,
        React.createElement(EnhanceSection, { refresh() {} })))
      export function render(open, working = false, finishing = false, request = 'A multiline request', connection = {}) {
        testCrew.finishing = finishing
        testCrew.visible = finishing
        set(run, finishing ? { runId: 'test', status: 'done', startedAt: 0, finishedAt: 1000, endPercent: 100, steps: [] } : null)
        set(busy, working ? 'enhance' : null)
        captured.length = 0
        set(optionsOpen, open)
        set(draft, request)
        set(catalogs, connection.connected ? { copilot: { models: [{id:'sol',label:'GPT-6.1 Terra',supportedReasoningEfforts:['high']}], source:'Copilot',fetchedAt:1, ...(connection.error ? {error:'Connection failed'} : {}) } } : {})
        set(catalogLoading, {copilot: connection.checking === true})
        set(copilotDetailsOpen, false)
        set(copilotCheck, connection.connected ? {attempt:4,startedAt:1,completedAt:2,outcome:'ok'} : null)
        set(result, 'An existing result')
        return { html: redraw(), inputs: captured }
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
    assert.match(html, />Retry connection</)
    assert.match(html, /Copilot has not been checked/)
    assert.ok(inputs.some(input => input !== request && typeof input.onKeyDown === 'function'), 'reviewed-result send shortcut remains')
  }
  const connected = module.exports.render(false, false, false, '', {connected:true}).html
  assert.match(connected, /aria-label="Connected: show connection details"/)
  assert.doesNotMatch(connected, />Check connection</)
  assert.doesNotMatch(connected, />Retry connection</)
  assert.doesNotMatch(connected, /Check 4 completed/)
  assert.match(connected, /Enter a request to enable Enhance/)
  assert.equal(module.exports.indicator()['aria-expanded'], false)
  module.exports.indicator().onClick()
  assert.equal(module.exports.indicator()['aria-expanded'], true)
  assert.equal(module.exports.indicator()['aria-controls'], 'copilot-connection-details')
  assert.match(module.exports.redraw(), /Check 4 completed/)
  assert.match(module.exports.redraw(), />Check connection</)
  module.exports.indicator().onClick()
  assert.doesNotMatch(module.exports.redraw(), /Check 4 completed/)
  const checking = module.exports.render(false, false, false, '', {connected:true,checking:true}).html
  assert.match(checking, /show connection details/)
  assert.doesNotMatch(checking, /id="copilot-connection-details"/)
  const failed = module.exports.render(false, false, false, '', {connected:true,error:true}).html
  assert.match(failed, /id="copilot-connection-details"/)
  assert.match(failed, /Connection failed/)
  assert.match(failed, />Retry connection</)
  assert.doesNotMatch(failed, /aria-label="Connected:/)
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
      export function render(editing = false, unavailableSelector = false, section = 'all') {
        set(models, { profiles: [], selectorProfileId: unavailableSelector ? 'retired' : null })
        set(dataSummary, { history: 0, profiles: 0, catalogs: 0 })
        set(catalogs, { form: { models: [{ id: 'gpt-5', label: 'GPT-5' }], source: 'copilot', fetchedAt: 1 } })
        set(form, editing ? { name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5', enabled: true } : null)
        const sections = section === 'settings' ? [SettingsSection] : section === 'models' ? [ModelsSection] : [SettingsSection, ModelsSection, RulesSection]
        return renderToStaticMarkup(React.createElement(TooltipProvider, null,
          ...sections.map(Component => React.createElement(Component))))
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
    for (const tier of ['Low', 'Medium', 'High']) assert.match(html, new RegExp(`aria-label="${tier} reasoning"`))
    assert.match(html, /Use recommended presets/)
    if (!editing) assert.match(html, /Advanced model options/)
  }
  const retired = module.exports.render(false, true)
  assert.match(retired, /saved file picker model is unavailable/)
  assert.match(retired, /aria-label="File picker model/)
  const settings = module.exports.render(false, false, 'settings')
  const models = module.exports.render(false, false, 'models')
  assert.doesNotMatch(settings, /Effort models|Low reasoning|Medium reasoning|High reasoning/)
  for (const tier of ['Low', 'Medium', 'High']) assert.match(models, new RegExp(`aria-label="${tier} reasoning"`))
  assert.match(models, /Copilot has not been checked/)
  assert.match(models, /Show Logs/)
  assert.match(models, /no profile setup is needed/)
  assert.match(models, /highest supported reasoning/)
  assert.match(models, /saved unsupported choice stays visible/)
  assert.ok(models.indexOf('Effort models') < models.indexOf('Advanced model options'))
})
