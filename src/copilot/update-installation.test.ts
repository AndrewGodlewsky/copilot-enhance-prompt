import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installationReader, parseCommentedJson, type PluginInventory } from './update-installation.ts'

test('comment parsing preserves URLs and Unicode without executing configuration', () => {
  assert.deepEqual(parseCommentedJson('// comment\n{"url":"https://github.com/a/b",/* comment */"text":"日本語 // exact"}'), { url: 'https://github.com/a/b', text: '日本語 // exact' })
  assert.throws(() => parseCommentedJson('({run:process.exit()})'))
})
test('installation resolution verifies package root, inventory, marketplace provenance, forks, direct sources and collisions', async () => {
  const home = await mkdtemp(join(tmpdir(), 'enhance-install-test-'))
  const root = join(home, 'installed-plugins', 'fixture', 'enhance-prompt')
  await mkdir(root, { recursive: true })
  const source = { source: 'github', repo: 'Someone/Fork', ref: 'beta' }
  const record: any = { name: 'enhance-prompt', marketplace: 'fixture', installed_source: source, version: '1.0.0', cache_path: root }
  const inventory: PluginInventory[] = [{ name: record.name, marketplace: record.marketplace, version: '1.0.0' }]
  const session = { rpc: { plugins: { list: async () => ({ plugins: inventory }), update: async () => {}, marketplaces: { list: async () => ({ marketplaces: [{ name: 'fixture', source: 'GitHub: Someone/Fork' }] }) } } } }
  const save = () => writeFile(join(home, 'config.json'), '// managed\n' + JSON.stringify({ installedPlugins: [record], credentials: 'never projected' }))
  try {
    await writeFile(join(root, 'plugin.json'), JSON.stringify({ name: record.name, version: '1.0.0' }))
    await writeFile(join(home, 'settings.json'), JSON.stringify({ extraKnownMarketplaces: { fixture: { source } } }))
    await save()
    const read = installationReader(session, root)
    const resolved = await read()
    assert.equal(resolved.target, 'enhance-prompt@fixture'); assert.equal(resolved.source?.repo, 'someone/fork'); assert.equal(resolved.source?.ref, 'beta'); assert.equal(resolved.canUpdate, true)
    assert.doesNotMatch(JSON.stringify(resolved), /credentials|never projected|cache_path/)
    inventory[0].installedFrom = home; assert.equal((await read()).canUpdate, false); delete inventory[0].installedFrom
    record.version = '0.9.0'; await save(); assert.match((await read()).reason!, /disagree/)
    record.version = '1.0.0'; record.marketplace = ''; record.source = source; inventory[0].marketplace = ''; await save()
    assert.equal((await read()).target, 'enhance-prompt')
    inventory.push({ name: record.name, marketplace: 'another' }); assert.equal((await read()).canUpdate, false); inventory.pop()
    record.installed_source = { source: 'local', path: root }; await save(); assert.match((await read()).reason!, /local/)
    assert.equal((await installationReader({ rpc: {} }, root)()).canUpdate, false)
    assert.match((await installationReader(session, home)()).reason!, /Unable/)
  } finally { await rm(home, { recursive: true, force: true, maxRetries: 5 }) }
})
