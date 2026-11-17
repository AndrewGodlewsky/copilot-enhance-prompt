import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('retained-data report names each scope and protects cleanup behind explicit restart confirmation', async () => {
  const compiled = await build({stdin:{contents:`
    import React from 'react'
    import {renderToStaticMarkup} from 'react-dom/server'
    import {StorageReport} from './src/retained-data.tsx'
    export function render(partial=false) {
      const size = {files:3,bytes:2048,unreadable:partial?1:0,partial}
      const view = {checkedAt:1,location:'Fixture storage',uploadLocation:'Fixture uploads',sessions:{current:size,active:size,inactive:size,unknown:size},shared:size,uploads:size,usage:size,recovery:size,other:size,history:{entries:10,bytes:1234},cleanup:{token:'opaque',count:2,bytes:4096,expiresAt:9999,sessions:[{id:'a'.repeat(24),updatedAt:1,bytes:2000}]}}
      return renderToStaticMarkup(React.createElement(StorageReport,{view,working:false,onClear(){}}))
    }`,resolveDir:fileURLToPath(new URL('../web/',import.meta.url))},tsconfig:'web/tsconfig.json',bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent'})
  const module = {exports:{}}
  new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
  const html = module.exports.render()
  for (const text of ['Current session','Other active workers','Known inactive sessions','Unverified sessions','Shared preferences','Upload copies','Usage receipts','Usage recovery metadata','History: 10 entries','do not delete uploads','restarted Copilot after updating']) assert.ok(html.includes(text),text)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Clear 2 inactive drafts<\/button>/)
  assert.match(html, /Review the 2 session files/)
  assert.match(module.exports.render(true), /At least/)
  assert.match(module.exports.render(true), /incomplete/)
})
