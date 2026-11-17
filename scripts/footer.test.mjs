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
    assert.ok(html.includes(`>v${module.exports.VERSION}</button>`))
    const version = html.match(/<button\b[^>]*title="View release history"[^>]*>/)?.[0]
    assert.ok(version, 'the footer version is a keyboard-accessible release-history trigger')
    assert.match(version, /aria-haspopup="dialog"/)
    assert.ok(version.includes(`aria-label="v${module.exports.VERSION}: view release history"`))
    assert.equal((html.match(/<button\b/g) ?? []).length, 3, 'Version history, Settings and Show Logs; no refresh button')
    assert.match(html, />Show Logs<\/button>/)
    assert.match(html, />Settings<\/button>/)
  } finally { process.env.LANG = oldLanguage }
})
