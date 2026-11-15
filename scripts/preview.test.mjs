import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('preview enhances Unicode input in English while preserving the input and history', async () => {
  const compiled = await build({
    stdin: {
      contents: `
        import { installMockHost } from './src/mock-host.ts'
        import { frame } from '../src/runtime.ts'
        export async function preview(prompt) {
          globalThis.document = { documentElement: {} }
          globalThis.location = { search: '' }
          globalThis.localStorage = { getItem: () => null }
          await installMockHost()
          const historyBefore = await frame().storage.get('history')
          const input = { runId: 'unicode-preview', prompt, files: ['C:/notes/đăng-nhập.txt'] }
          const result = await frame().plugin.request('prompt.enhance', input)
          return { result, input, historyBefore, historyAfter: await frame().storage.get('history') }
        }
      `,
      resolveDir: fileURLToPath(new URL('../web/', import.meta.url))
    },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'true' }, loader: { '.md': 'text' }
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const prompt = 'Sửa trang đăng nhập trên điện thoại 📱'
  const { result, input, historyBefore, historyAfter } = await module.exports.preview(prompt)
  assert.match(result.enhanced, /^Fix the login page layout on mobile screens/)
  assert.match(result.enhanced, /Attached files:\n- C:\/notes\/đăng-nhập\.txt$/)
  assert.equal(input.prompt, prompt)
  assert.deepEqual(historyAfter, historyBefore)
  assert.equal(historyAfter[0].original, 'login page is broken on mobile')
})
