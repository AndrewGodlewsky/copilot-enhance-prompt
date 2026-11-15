import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('footer renders English links, version, settings and logs in a non-English environment', async () => {
  const compiled = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { Footer } from './src/footer.tsx'
        import { VERSION } from '../src/version.ts'
        export { VERSION }
        export function render() {
          let opened = false
          const footer = Footer({ onSettings: () => { opened = true } })
          const settings = footer.props.children.find(child => child?.type === 'button')
          settings.props.onClick()
          return { html: renderToStaticMarkup(footer), opened }
        }
      `,
      resolveDir: fileURLToPath(new URL('../web/', import.meta.url))
    },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, loader: { '.md': 'text' }
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const oldLanguage = process.env.LANG
  process.env.LANG = 'zh_CN.UTF-8'
  try {
    const { html, opened } = module.exports.render()
    assert.equal(opened, true, 'settings action invokes the supplied section navigation')
    assert.match(html, /href="https:\/\/github.com\/AndrewGodlewsky\/copilot-enhance-prompt"[^>]*>Enhance Prompt<\/a>/)
    assert.match(html, /href="https:\/\/github.com\/AndrewGodlewsky\/copilot-enhance-prompt\/issues\/new"/)
    assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, 2)
    assert.ok(html.includes(`>v${module.exports.VERSION}</span>`))
    assert.equal((html.match(/<button\b/g) ?? []).length, 2, 'only Settings and Show Logs; no version or refresh button')
    assert.match(html, />Show Logs<\/button>/)
    assert.match(html, />Settings<\/button>/)
  } finally { process.env.LANG = oldLanguage }
})
