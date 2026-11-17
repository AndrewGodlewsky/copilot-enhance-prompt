import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
const relative = file => path.relative(root, path.resolve(file)).split(path.sep).join('/')
const sorted = values => [...new Set(values)].sort()
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const normalizeText = text => text.replace(/\r\n/g, '\n')
const json = async file => JSON.parse(await readFile(path.resolve(root, file), 'utf8'))
const permittedLicenses = new Set(['MIT', 'ISC', 'BlueOak-1.0.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0'])
const copiedLicenses = ['licenses/shadcn.txt', 'licenses/reui.txt']
const licenseOverrides = { 'react-remove-scroll-bar@2.3.8': 'licenses/react-remove-scroll-bar-2.3.8.txt' }
const cssPackages = ['tailwindcss', 'tw-animate-css']

export async function hashFiles(files, directory = root) {
  return Promise.all(sorted(files).map(async file => {
    const raw = await readFile(path.resolve(directory, file))
    // Git may check text out with CRLF. Record canonical text hashes, exact binary hashes.
    const text = /\.(?:[cm]?[jt]sx?|json|md|txt|css|html|svg)$/.test(file) || /(?:^|\/)LICENSE$/.test(file)
    const bytes = text ? Buffer.from(normalizeText(raw.toString('utf8'))) : raw
    return { path: file, bytes: bytes.length, sha256: sha(bytes), normalization: text ? 'lf' : 'none' }
  }))
}
export async function packageNotices(directory) {
  const files = (await readdir(directory)).filter(file => /^(licen[sc]e|copying|notice|copyright(?:notice)?)(?:[.-].*)?$/i.test(file)).sort()
  if (!files.length) {
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const snapshot = licenseOverrides[`${pkg.name}@${pkg.version}`]
    if (!snapshot) throw new Error(`Missing license text: ${relative(directory)}`)
    return [{ file: 'LICENSE (reviewed upstream snapshot)', path: snapshot, text: normalizeText(await readFile(path.join(root, snapshot), 'utf8')).trim() }]
  }
  return Promise.all(files.map(async file => {
    const text = normalizeText(await readFile(path.join(directory, file), 'utf8')).trim()
    if (!text) throw new Error(`Empty license text: ${relative(directory)}/${file}`)
    return { file, path: relative(path.join(directory, file)), text }
  }))
}
export function frontendInventory() {
  return { name: 'enhance-distribution-inventory', async generateBundle(_options, bundle) {
    const files = sorted(Object.values(bundle).filter(item => item.type === 'chunk').flatMap(item =>
      Object.entries(item.modules).filter(([, data]) => data.renderedLength > 0).map(([file]) => file)
    ).filter(file => !file.includes('\0')).map(file => relative(file.split('?')[0])))
    await mkdir(path.join(root, '.artifacts'), { recursive: true })
    await writeFile(path.join(root, '.artifacts/distribution-web.json'), JSON.stringify(files))
  } }
}
async function walk(directory) {
  const entries = await readdir(path.resolve(root, directory), { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat()
}
function packageRoot(file) {
  const marker = 'node_modules/', start = file.lastIndexOf(marker)
  if (start < 0) return
  const names = file.slice(start + marker.length).split('/')
  return file.slice(0, start + marker.length) + names.slice(0, names[0].startsWith('@') ? 2 : 1).join('/')
}
async function generate(inputs) {
  const locks = { root: await json('package-lock.json'), web: await json('web/package-lock.json') }
  // CSS transforms do not expose their imported package files in emitted JS chunk modules.
  const cssInputs = (await Promise.all(cssPackages.map(name => walk(`web/node_modules/${name}`)))).flat().filter(file => file.endsWith('.css')).sort()
  const sourceInputs = sorted([...inputs, ...cssInputs])
  const packagePaths = sorted([...inputs.map(packageRoot).filter(Boolean), ...cssPackages.map(name => `web/node_modules/${name}`)])
  const packages = [], noticeSections = []
  for (const directory of packagePaths) {
    const pkg = await json(`${directory}/package.json`)
    const tree = directory.startsWith('web/') ? 'web' : 'root'
    const key = tree === 'web' ? directory.slice(4) : directory
    const locked = locks[tree].packages[key]
    assert.equal(locked?.version, pkg.version, `Installed version differs from lock: ${directory}`)
    assert.ok(locked?.integrity, `Missing locked integrity: ${directory}`)
    assert.ok(permittedLicenses.has(pkg.license), `Review new license expression: ${directory}: ${pkg.license}`)
    const notices = await packageNotices(path.join(root, directory))
    const files = sourceInputs.filter(file => packageRoot(file) === directory)
    const component = { name: pkg.name, version: pkg.version, license: pkg.license, directory, integrity: locked.integrity,
      kind: cssPackages.includes(pkg.name) ? 'css' : tree === 'root' ? 'backend-js' : 'frontend-js',
      files, notices: notices.map(item => ({ path: item.path, sha256: sha(item.text) })) }
    packages.push(component)
    noticeSections.push(`## ${pkg.name} ${pkg.version}\n\n${component.kind}; locked license: ${pkg.license}.\n\n${notices.map(item => `### ${item.file}\n\n\`\`\`text\n${item.text}\n\`\`\``).join('\n\n')}`)
  }
  const cssImports = [...(await readFile(path.join(root, 'web/src/index.css'), 'utf8')).matchAll(/@import\s+["']([^"']+)["']/g)].map(match => match[1]).sort()
  assert.deepEqual(cssImports, [...cssPackages].sort(), 'Review new CSS imports and add their licenses')
  const projectInputs = inputs.filter(file => !packageRoot(file))
  const sourcePaths = sorted([...sourceInputs, ...await walk('web/src/components/ui'), 'web/src/lib/utils.ts', 'web/src/index.css', 'web/components.json', 'web/vite.config.ts', 'scripts/build.mjs', 'scripts/distribution.mjs', 'docs/distribution-components.md', ...copiedLicenses, ...Object.values(licenseOverrides)])
  const assets = await hashFiles([...await walk('assets'), ...await walk('docs/design/word-crew').then(files => files.filter(file => /\.png$/.test(file))), 'docs/assets/prompt-workflow.svg'])
  const artifacts = await hashFiles(['com.github.copilot/extensions/enhance-prompt/extension.mjs', ...await walk('com.github.copilot/extensions/enhance-prompt/web'), 'plugin.json', 'LICENSE', 'assets/icon.svg'])
  const inventory = { schema: 1, plugin: (await json('plugin.json')).name, version: (await json('plugin.json')).version,
    hostProvided: ['@github/copilot-sdk', '@github/copilot-sdk/extension', 'Copilot executable', 'Node built-ins', 'system fonts'],
    packages, assets, artifacts, locks: await hashFiles(['package-lock.json', 'web/package-lock.json']),
    inputs: await hashFiles(sourcePaths), tracedInputs: inputs,
    projectInputs, nonEmittedPackages: Object.entries(locks).flatMap(([tree, lock]) => Object.entries(lock.packages)
      .filter(([key]) => key && !packagePaths.includes(tree === 'web' ? `web/${key}` : key))
      .map(([key, item]) => ({ directory: tree === 'web' ? `web/${key}` : key, version: item.version }))) }
  const copied = await Promise.all(copiedLicenses.map(async file => `## Copied UI: ${file}\n\n\`\`\`text\n${normalizeText(await readFile(path.join(root, file), 'utf8')).trim()}\n\`\`\``))
  const notes = `# Third-party notices\n\nGenerated by scripts/distribution.mjs from emitted JavaScript modules, reviewed CSS inputs and locked installed packages. Preserve this file and LICENSE when distributing the plugin. The original project copyright remains in LICENSE. This inventory is not a security certification.\n\nCopied shadcn/ReUI components are modified in web/src/components/ui and web/src/lib/utils.ts. Their MIT notices are included below. Lucide's full license includes Feather-derived icons. No font files are bundled; the panel uses system fonts. The green Lift icon, Quiet Desk and word-crew artwork are project assets; provenance and non-runtime design references are recorded in [distribution components](docs/distribution-components.md).\n\nCopilot supplies its SDK/runtime separately; it is not redistributed here. Build tools and tree-shaken packages listed as nonEmittedPackages in runtime-inventory.json are not automatically runtime code. Tailwind CSS is included even though its compiler is a development dependency.\n\n${[...copied, ...noticeSections].join('\n\n')}\n`
  return { inventory, notes }
}
export async function writeDistribution(backend) {
  const backendInputs = sorted(Object.values(backend.outputs).flatMap(output => Object.entries(output.inputs).filter(([, item]) => item.bytesInOutput > 0).map(([file]) => file)))
  const inputs = sorted([...backendInputs, ...await json('.artifacts/distribution-web.json')])
  const { inventory, notes } = await generate(inputs)
  await writeFile(path.join(root, 'runtime-inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
  await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), notes)
}
export async function checkDistribution() {
  const saved = await json('runtime-inventory.json')
  const { inventory, notes } = await generate(saved.tracedInputs)
  assert.deepEqual(saved, inventory, 'Runtime inventory drift: rebuild, review dependency/assets/license changes, and commit generated inventory')
  assert.equal(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), notes, 'Third-party notices drift: rebuild and review')
}
