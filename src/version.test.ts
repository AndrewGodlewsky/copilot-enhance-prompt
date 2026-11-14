// The version the panel shows is the one the host installs.
import { readFileSync } from 'node:fs'
import { assert, test } from '#testing'
import { VERSION } from './version.ts'

test('src/version.ts matches plugin.json', () => {
  const manifest = JSON.parse(readFileSync(new URL('../plugin.json', import.meta.url), 'utf8')) as { version: string }
  assert.equal(VERSION, manifest.version)
})

test('the built panel shows this version', () => {
  // The header prints VERSION, and the host runs the committed build (src/web-dist), not web/src: after
  // a version change the panel has to be built again.
  const built = readFileSync(new URL('./web-dist/assets/app.js', import.meta.url), 'utf8')
  const quoted = new RegExp(`[\`'"]${VERSION.replace(/\./g, '\\.')}[\`'"]`)
  assert.match(built, quoted, `src/web-dist was built from another version: run npm run web:build`)
})
