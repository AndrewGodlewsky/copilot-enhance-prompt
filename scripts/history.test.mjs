import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('History library expands saved text inline, with accessible project and prompt disclosures', async () => {
  const compiled = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { HistorySection, HistoryReader } from './src/history.tsx'
        import { set } from '../src/runtime.ts'
        import { historyRaw, historyScope, historyFilter, historyOpen, historyPageNumber, historyOrder, historyProjectsExpanded, projectName } from '../src/panel/state.ts'
        export const render = (entries, query = '', scope = 'all', selected = null, projectsExpanded = true) => {
          set(historyRaw, entries); set(historyFilter, query); set(historyScope, scope)
          set(historyOpen, selected); set(historyPageNumber, 1); set(historyOrder, 'newest')
          set(historyProjectsExpanded, projectsExpanded)
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
  const entries = [entry, { ...entry, id: 'two', project: 'D:/Other/enhance-prompt' }, { ...entry, id: 'old', project: undefined }]
  const html = module.exports.render(entries, 'retry', 'all', entry.id)
  for (const label of ['Search original and enhanced prompts', 'Filter history by project', 'Order prompts', 'All projects', 'No project recorded', 'Match in enhanced prompt', 'Reuse', 'Copy', 'Delete', 'Previous', 'Next']) assert.ok(html.includes(label), label)
  assert.match(html, /enhance-prompt \(C:\/Projects\)/)
  assert.match(html, /enhance-prompt \(D:\/Other\)/)
  assert.doesNotMatch(html, /<script>/)
  const articles = [...html.matchAll(/<article\b[^>]*>(.*?)<\/article>/gs)].map(match => match[1])
  assert.equal(articles.length, 3, 'each prompt owns its inline details')
  assert.match(articles[0], /aria-expanded="true"/)
  assert.match(articles[0], /class="history-reader"/)
  assert.match(articles[1], /aria-expanded="false"/)
  assert.doesNotMatch(articles[1], /class="history-reader"/)
  const controlled = articles[0].match(/aria-controls="([^"]+)"/)[1]
  assert.ok(articles[0].includes(`id="${controlled}"`), 'the disclosure controls its own content')
  const collapsed = module.exports.render(entries)
  assert.doesNotMatch(collapsed, /class="history-reader"/, 'no prompt opens automatically')
  assert.match(collapsed, /aria-label="Hide projects"[^>]*aria-expanded="true"/)
  const second = module.exports.render(entries, '', 'all', 'two')
  assert.equal((second.match(/class="history-reader"/g) || []).length, 1, 'only one prompt expands at a time')
  const hiddenProjects = module.exports.render(entries, '', 'path:D:/Other/enhance-prompt', 'two', false)
  assert.match(hiddenProjects, /aria-label="Show projects"[^>]*aria-expanded="false"/)
  assert.match(hiddenProjects, /<aside[^>]*aria-label="Projects"[^>]*hidden=""/)
  assert.equal((hiddenProjects.match(/<article\b/g) || []).length, 1, 'hiding navigation preserves the project filter')
  assert.match(hiddenProjects, /class="history-reader"/, 'hiding projects does not collapse the prompt')
  assert.doesNotMatch(module.exports.render(entries, '', 'path:D:/Other/enhance-prompt', 'one'), /class="history-reader"/, 'hidden selections cannot reveal an unrelated prompt')
  const reader = module.exports.reader(entry, 'enhanced')
  assert.match(reader, /<section[^>]*aria-label="Prompt details"/)
  assert.doesNotMatch(reader, /<h3/, 'the inline reader does not repeat the row heading')
  assert.doesNotMatch(reader, /lucide-folder|history-project-heading/)
  assert.match(reader, /Project location/)
  assert.match(reader, /C:\/Projects\/enhance-prompt/)
  assert.match(reader, /&lt;script&gt;/)
  assert.match(reader, /café\/notes.md/)
  assert.match(module.exports.reader(entry, 'original'), /résumé.ts/)
  assert.match(module.exports.render([entry], 'missing'), /No matching prompts/)
  assert.match(module.exports.render([]), /No history yet/)
})
