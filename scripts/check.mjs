import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'

for (const config of ['.', 'web']) {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', config], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const manifest = JSON.parse(await readFile('plugin.json', 'utf8'))
const catalog = JSON.parse(await readFile('.github/plugin/marketplace.json', 'utf8'))
assert.equal(manifest.name, 'enhance-prompt')
assert.equal(catalog.plugins[0].name, manifest.name)
assert.equal(catalog.plugins[0].source, './')
const logoPath = manifest.extensions?.['com.github.copilot']?.logo
assert.equal(logoPath, 'assets/icon.svg', 'Keep the compact vector logo for desktop plugin metadata')
const logo = await readFile(logoPath)
assert.match(logo.toString('utf8'), /<svg\b/)
// Copilot 1.4.2 accepts base64 PNG/SVG plugin icons up to 350,000 characters.
assert.ok(`data:image/svg+xml;base64,${logo.toString('base64')}`.length <= 350000, 'Plugin logo exceeds the desktop icon limit')
assert.match(await readFile('src/version.ts', 'utf8'), new RegExp(`'${manifest.version.replaceAll('.', '\\.')}'`))
const built = 'com.github.copilot/extensions/enhance-prompt'
const extension = await readFile(`${built}/extension.mjs`, 'utf8')
assert.match(extension, /@github\/copilot-sdk\/extension/)
assert.match(extension, /Session connected/)
async function compare(folder, target) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) await compare(path.join(folder, entry.name), path.join(target, entry.name))
    else assert.deepEqual(await readFile(path.join(folder, entry.name)), await readFile(path.join(target, entry.name)), `Stale packaged panel: ${entry.name}`)
  }
}
await compare('src/web-dist', `${built}/web`)
const retiredHost = new RegExp(String.fromCharCode(111, 114, 99, 97), 'i')
// Preserve source attribution while rejecting references to the retired host integration.
const upstreamAttribution = 'https://github.com/cattfan/orca-enhance-prompt'
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
for (const file of files) {
  if (!/\.(?:[cm]?[jt]sx?|json|md|css|html|ya?ml|ps1|svg)$/.test(file)) continue
  if (!await access(file).then(() => true, () => false)) continue
  assert.ok(!retiredHost.test(file), `Retired host in filename: ${file}`)
  const content = (await readFile(file, 'utf8')).replaceAll(upstreamAttribution, '')
  assert.ok(!retiredHost.test(content), `Retired host reference: ${file}`)
}
console.log('PASS: types, manifest, catalog, packaged assets and platform-reference checks.')
