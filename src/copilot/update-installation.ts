import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { githubSource } from '../updates/metadata.ts'
import type { Installation } from '../updates/types.ts'

export type PluginInventory = { name: string; marketplace: string; version?: string; installedFrom?: string; source?: string; installed?: boolean; directSourceId?: string }
export type UpdateSession = { rpc: { plugins?: {
  list(): Promise<{ plugins: PluginInventory[] }>
  update?: (input: { name: string }) => Promise<unknown>
  marketplaces: { list(): Promise<{ marketplaces: { name: string; source: string; managed?: boolean; team?: boolean }[] }> }
} } }

// Copilot's managed JSON has leading comments. No evaluation and no credential projection.
export function parseCommentedJson(text: string): any {
  let out = '', quoted = false, escaped = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1]
    if (!quoted && c === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue }
    if (!quoted && c === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; out += ' '; continue }
    out += c
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false }
    else if (c === '"') quoted = true
  }
  return JSON.parse(out.replace(/^\uFEFF/, ''))
}
async function json(file: string) {
  if ((await stat(file)).size > 2_000_000) throw new Error('Metadata too large')
  return parseCommentedJson(await readFile(file, 'utf8'))
}
export const installationKey = (root: string) => createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex')

export function installationReader(session: UpdateSession, packageRoot: string, name = 'enhance-prompt') {
  return async (): Promise<Installation> => {
    const scope = installationKey(packageRoot)
    const unsupported = (reason: string, installed?: string): Installation => ({ scope, installed, canUpdate: false, reason })
    if (!session.rpc.plugins?.list) return unsupported('This Copilot runtime does not expose plugin inventory. Update through Customize → Installed.')
    try {
      const root = await realpath(packageRoot)
      // The package location identifies the actual profile; never guess ~/.copilot or use a helper profile.
      const cache = dirname(dirname(root))
      const disk = await json(join(root, 'plugin.json'))
      if (basename(cache) !== 'installed-plugins' || root.startsWith('\\\\') || disk.name !== name) return unsupported('This is a local or development installation. Update its source files and start a new Copilot session.', disk.version)
      const home = dirname(cache)
      const records = (await json(join(home, 'config.json'))).installedPlugins
      if (!Array.isArray(records)) return unsupported('Copilot installation provenance is unavailable.', disk.version)
      const matches = []
      for (const row of records) if (row?.name === name && typeof row.cache_path === 'string' && await realpath(row.cache_path).catch(() => '') === root) matches.push(row)
      if (matches.length !== 1) return unsupported('This package cannot be matched uniquely to Copilot’s installation records.', disk.version)
      const record = matches[0]
      const inventory = await session.rpc.plugins.list()
      const eligible = inventory.plugins.filter(p => p.name === name && (record.marketplace ? p.marketplace === record.marketplace : !p.marketplace))
      if (!record.marketplace && inventory.plugins.filter(p => p.name === name).length !== 1) return unsupported('Another installation shares this plugin name. Manage updates in Copilot.', disk.version)
      if (eligible.length !== 1 || eligible[0].installed === false || eligible[0].installedFrom || eligible[0].source === 'builtin') return unsupported('The attached session does not identify one updatable installation of this plugin.', disk.version)
      const source = githubSource(record.installed_source)
      if (!source) return unsupported('Automatic updating is unavailable for this local, private-host, or unrecognized source.', disk.version)
      let marketplace
      if (record.marketplace) {
        const settings = await json(join(home, 'settings.json'))
        marketplace = githubSource(settings?.extraKnownMarketplaces?.[record.marketplace]?.source)
        const markets = (await session.rpc.plugins.marketplaces.list()).marketplaces.filter(m => m.name === record.marketplace)
        // The inventory string confirms this registration. Ref/path semantics come from the structured record.
        if (!marketplace || markets.length !== 1 || markets[0].managed || markets[0].team || markets[0].source.toLowerCase() !== `GitHub: ${marketplace.repo}`.toLowerCase()) return unsupported('The marketplace’s current source cannot be verified. Manage updates in Copilot.', disk.version)
      } else if (!githubSource(record.source) || JSON.stringify(githubSource(record.source)) !== JSON.stringify(source)) return unsupported('The direct installation source has changed. Review it in Copilot.', disk.version)
      const target = record.marketplace ? `${name}@${record.marketplace}` : name
      if (!/^[\w.-]+(?:@[\w.-]+)?$/.test(target)) return unsupported('The installed plugin identity is invalid.', disk.version)
      const fingerprint = installationKey(JSON.stringify([root, target, source, marketplace]))
      if (record.version !== disk.version || eligible[0].version !== disk.version) return { scope: fingerprint, installed: disk.version, canUpdate: false, reason: 'The installed files and Copilot inventory disagree. Finish or repair the update in Copilot before retrying.' }
      return { scope: fingerprint, target, installed: disk.version, source, marketplace,
        canUpdate: typeof session.rpc.plugins.update === 'function',
        ...(!session.rpc.plugins.update ? { reason: 'This runtime cannot update from a canvas. Use Customize → Installed → Update.' } : {}) }
    } catch { return unsupported('Unable to verify this installation’s source. Check Copilot’s installation state and try again.') }
  }
}
