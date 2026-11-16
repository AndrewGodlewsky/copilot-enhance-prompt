import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('History library renders a title-first reader, safe saved text, project navigation and existing actions', async () => {
  const compiled = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { HistorySection, HistoryReader } from './src/history.tsx'
        import { set } from '../src/runtime.ts'
        import { historyRaw, historyScope, historyFilter, historyOpen, historyPageNumber, historyOrder, projectName } from '../src/panel/state.ts'
        export const render = (entries, query = '', scope = 'all') => {
          set(historyRaw, entries); set(historyFilter, query); set(historyScope, scope)
          set(historyOpen, entries[0]?.id ?? null); set(historyPageNumber, 1); set(historyOrder, 'newest')
          set(projectName, 'C:/Projects/enhance-prompt')
          return renderToStaticMarkup(React.createElement(HistorySection))
        }
        export const reader = (entry, text) => renderToStaticMarkup(React.createElement(HistoryReader, {entry, text, onTextChange: () => {}}))
      `,
      resolveDir: fileURLToPath(new URL('../web/', import.meta.url))
    },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    loader: { '.css': 'empty' }
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const entry = { id: 'one', at: 1794765600000, original: 'Review the catalog\nPreserve résumé.ts.', enhanced: '<script>alert("retry")</script>\nKeep café/notes.md.', project: 'C:/Projects/enhance-prompt', model: 'gpt-5', style: 'balanced', source: 'panel' }
  const html = module.exports.render([entry, { ...entry, id: 'two', project: 'D:/Other/enhance-prompt' }, { ...entry, id: 'old', project: undefined }], 'retry')
  for (const label of ['Search original and enhanced prompts', 'Filter history by project', 'Order prompts', 'All projects', 'No project recorded', 'Match in enhanced prompt', 'Reuse', 'Copy', 'Delete', 'Previous', 'Next']) assert.ok(html.includes(label), label)
  assert.match(html, /enhance-prompt \(C:\/Projects\)/)
  assert.match(html, /enhance-prompt \(D:\/Other\)/)
  assert.doesNotMatch(html, /<script>/)
  const reader = module.exports.reader(entry, 'enhanced')
  assert.match(reader, /<section[^>]*aria-label="Selected prompt"[^>]*><h3/)
  assert.doesNotMatch(reader, /lucide-folder|history-project-heading/)
  assert.match(reader, /Project location/)
  assert.match(reader, /C:\/Projects\/enhance-prompt/)
  assert.match(reader, /&lt;script&gt;/)
  assert.match(reader, /café\/notes.md/)
  assert.match(module.exports.reader(entry, 'original'), /résumé.ts/)
  assert.match(module.exports.render([entry], 'missing'), /No matching prompts/)
  assert.match(module.exports.render([]), /No history yet/)
})
