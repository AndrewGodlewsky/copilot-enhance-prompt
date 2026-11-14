// The look: flat colours only, in the logo and in everything that draws pictures of the panel.
import { readdirSync, readFileSync } from 'node:fs'
import { assert, test } from '#testing'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('no gradients in the logo or the picture scripts', () => {
  const scripts = readdirSync(new URL('../scripts/', import.meta.url)).filter((name) => name.endsWith('.mjs'))
  for (const path of ['assets/icon.svg', ...scripts.map((name) => `scripts/${name}`)]) {
    assert.ok(!/gradient/i.test(read(path)), `${path} has a gradient`)
  }
  // The Lift logo uses a green speech bubble and a charcoal tile and arrow.
  const icon = read('assets/icon.svg')
  assert.match(icon, /fill="#182024"/)
  assert.match(icon, /fill="#4CCB78"/)
})
