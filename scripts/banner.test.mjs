import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('Quiet Desk renders every still scene and one translated theme action without the old header logo/version', async () => {
  const compiled = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { QuietDesk, DeskIllustration } from './src/quiet-desk.tsx'
        import { TooltipProvider } from './src/components/ui/tooltip.tsx'
        import { set } from '../src/runtime.ts'
        import { colorTheme } from '../src/panel/appearance.ts'
        import { uiLanguageSetting } from '../src/i18n.ts'
        export const scene = (time, state) => renderToStaticMarkup(React.createElement(DeskIllustration, { time, state }))
        export const banner = (theme, language) => {
          set(colorTheme, theme); set(uiLanguageSetting, language)
          return renderToStaticMarkup(React.createElement(TooltipProvider, null, React.createElement(QuietDesk)))
        }
      `,
      resolveDir: fileURLToPath(new URL('../web/', import.meta.url))
    },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const scenes = []
  for (const time of ['morning', 'afternoon', 'night']) for (const state of ['idle', 'draft', 'running', 'ready', 'error', 'cancelled']) {
    const svg = module.exports.scene(time, state)
    assert.match(svg, /^<svg/)
    assert.match(svg, /aria-hidden="true"/)
    assert.doesNotMatch(svg, /undefined|NaN|<animate|<script/)
    assert.equal(svg.includes('rotate(8 270 119)'), state === 'ready', 'only a ready prompt gets the finished page')
    scenes.push(svg)
  }
  assert.equal(new Set(scenes).size, 18)
  for (const language of ['en', 'vi', 'zh']) {
    const light = module.exports.banner('light', language)
    const dark = module.exports.banner('dark', language)
    assert.equal((light.match(/<button\b/g) ?? []).length, 1)
    assert.equal((dark.match(/<button\b/g) ?? []).length, 1)
    assert.match(light, /GitHub Copilot/)
    assert.match(light, /<h1>Enhance Prompt<\/h1>/)
    assert.doesNotMatch(light, /<img\b|v0\./)
    assert.notEqual(light.match(/aria-label="([^"]+)"/)[1], dark.match(/aria-label="([^"]+)"/)[1])
  }
})
