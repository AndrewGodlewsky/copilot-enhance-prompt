import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { assert, test } from '#testing'
import { VERSION } from './version.ts'

test('the English changelog and manifest begin with the current plugin version', () => {
  const versions = [...readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').matchAll(/^## \[([^\]]+)\]/gm)].map(match => match[1])
  assert.equal(versions[0], VERSION)
  assert.equal(JSON.parse(readFileSync(new URL('../plugin.json', import.meta.url), 'utf8')).version, VERSION)
  assert.equal(new Set(versions).size, versions.length)
  assert.ok(versions.includes('0.2.4'), 'Keep historical English release notes')
})

test('the built panel has only the English release notes, with no stale translated chunks', () => {
  for (const directory of ['src/web-dist/assets/', 'com.github.copilot/extensions/enhance-prompt/web/assets/']) {
    const files = readdirSync(new URL(`../${directory}`, import.meta.url))
    assert.deepEqual(files.filter(name => name.startsWith('CHANGELOG')), ['CHANGELOG.js'])
    const notes = readFileSync(new URL(`../${directory}CHANGELOG.js`, import.meta.url), 'utf8')
    assert.ok(notes.includes(`## [${VERSION}]`))
    assert.ok(!files.some(name => /i18n|locale|\.vi\.|\.zh/i.test(name)))
  }
  const loader = readFileSync(new URL('../web/src/whats-new.tsx', import.meta.url), 'utf8')
  assert.ok(loader.includes('CHANGELOG.md?raw'))
  assert.doesNotMatch(loader, /currentLanguage|UiLanguage|CHANGELOG\.(vi|zh)/)
  for (const removed of ['src/i18n.ts', 'src/i18n-dict.ts', 'docs/readme/README.vi.md', 'docs/readme/README.zh-CN.md', 'docs/changelog/CHANGELOG.vi.md', 'docs/changelog/CHANGELOG.zh-CN.md']) {
    assert.equal(existsSync(new URL(`../${removed}`, import.meta.url)), false, removed)
  }
})
