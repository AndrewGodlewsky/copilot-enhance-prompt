import { compareVersions } from './version.ts'
import type { Available, GitHubSource, Installation } from './types.ts'

export class UpdateError extends Error {
  readonly code: string
  readonly retryAfter: number
  constructor(message: string, code = 'unavailable', retryAfter = 0) { super(message); this.code = code; this.retryAfter = retryAfter }
}
export function githubSource(value: unknown): GitHubSource | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const v = value as Record<string, unknown>
  let repo = v.repo
  if (v.source === 'url' && typeof v.url === 'string') {
    const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(v.url)
    repo = match?.[1]
  } else if (v.source !== 'github') return
  if (typeof repo !== 'string' || !/^[\w-]+\/[\w.-]+$/.test(repo) || repo.includes('..')) return
  for (const key of ['ref', 'sha', 'path']) if (v[key] !== undefined && (typeof v[key] !== 'string' || !(v[key] as string).length || (v[key] as string).length > 200)) return
  if (v.sha && !/^[0-9a-f]{40}$/i.test(String(v.sha))) return
  const path = String(v.path ?? '').replace(/^\.\//, '').replace(/\/$/, '')
  if (path && (!/^[\w./-]+$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..'))) return
  return { repo: repo.toLowerCase(), ...(v.ref ? { ref: String(v.ref) } : {}), ...(v.sha ? { sha: String(v.sha).toLowerCase() } : {}), ...(path ? { path } : {}) }
}
export const sameSource = (a: GitHubSource | undefined, b: GitHubSource | undefined) => !!a && !!b && a.repo === b.repo && a.ref === b.ref && a.sha === b.sha && (a.path ?? '') === (b.path ?? '')

// Redirects and credential forwarding are intentionally forbidden. Only JSON metadata is read.
export function metadataReader(fetcher: typeof fetch = fetch, timeoutMs = 8_000) {
  return async function read(url: string, head = false): Promise<any> {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !['api.github.com', 'raw.githubusercontent.com'].includes(parsed.hostname) || parsed.username || parsed.password) throw new UpdateError('The update metadata address is not supported.')
    const signal = AbortSignal.timeout(timeoutMs)
    try {
      const response = await fetcher(url, { method: head ? 'HEAD' : 'GET', signal, redirect: 'error', credentials: 'omit', headers: { Accept: 'application/json' } })
      if (response.status === 429 || response.status === 403) {
        const seconds = Number(response.headers.get('retry-after'))
        throw new UpdateError('GitHub limited the update check or the source is not public. Try again later.', 'rate_limited', Math.min(86_400_000, Math.max(60_000, (Number.isFinite(seconds) ? seconds : 3600) * 1000)))
      }
      if (response.status === 404) throw new UpdateError('The configured update metadata could not be found.', 'not_found')
      if (head && response.ok) { await response.body?.cancel(); return true }
      if (!response.ok || !response.body) throw new UpdateError('GitHub could not provide update metadata.', 'network')
      const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = []
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 128_000) throw new UpdateError('Update metadata exceeds the size limit.', 'invalid_params')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      if (error instanceof UpdateError) throw error
      throw new UpdateError(signal.aborted ? 'The update check timed out. Try again when connected.' : 'Unable to read update metadata. Check your connection and try again.', signal.aborted ? 'timeout' : 'network')
    }
  }
}

export function remoteMetadata(read = metadataReader(), identity = { name: 'enhance-prompt', manifest: 'plugin.json', catalog: '.github/plugin/marketplace.json', changelog: 'CHANGELOG.md' }) {
  const branch = async (source: GitHubSource) => {
    if (source.sha || source.ref && /^[0-9a-f]{7,40}$/i.test(source.ref)) throw new UpdateError('This installation is pinned to a commit. Change its source in Copilot to opt into updates.', 'pinned')
    const api = `https://api.github.com/repos/${source.repo}`
    const ref = source.ref ?? (await read(api)).default_branch
    if (typeof ref !== 'string' || !ref || ref.length > 200) throw new UpdateError('The source branch could not be determined.', 'invalid_params')
    let head
    try { head = await read(`${api}/git/ref/heads/${encodeURIComponent(ref)}`) }
    catch (error) { if ((error as UpdateError).code === 'not_found') throw new UpdateError('This source is pinned to a tag or its branch is unavailable. Manage its source in Copilot.', 'pinned'); throw error }
    // A name shared by a branch and tag is ambiguous to installers; do not guess.
    if (source.ref) {
      try { await read(`${api}/git/ref/tags/${encodeURIComponent(ref)}`); throw new UpdateError('The source name identifies both a branch and tag. Automatic updating is unavailable.', 'pinned') }
      catch (error) { if ((error as UpdateError).code !== 'not_found') throw error }
    }
    if (!/^[0-9a-f]{40}$/i.test(head?.object?.sha ?? '') || head?.object?.type !== 'commit') throw new UpdateError('The branch metadata is invalid.', 'invalid_params')
    return head.object.sha as string
  }
  const raw = (source: GitHubSource, sha: string, file: string) => `https://raw.githubusercontent.com/${source.repo}/${sha}/${source.path ? source.path + '/' : ''}${file}`
  return async (installation: Installation): Promise<Available> => {
    if (!installation.source) throw new UpdateError(installation.reason ?? 'Installation source is unknown.')
    let sha: string
    if (installation.marketplace) {
      const market = installation.marketplace
      const marketSha = await branch(market)
      const catalog = await read(raw(market, marketSha, identity.catalog))
      const entries = Array.isArray(catalog?.plugins) ? catalog.plugins.filter((p: any) => p?.name === identity.name) : []
      if (entries.length !== 1) throw new UpdateError('The marketplace no longer identifies this plugin uniquely.')
      const entry = entries[0].source
      const selected = typeof entry === 'string' && /^\.\/(?:[\w./-]*)$/.test(entry)
        ? githubSource({ source: 'github', ...market, path: [market.path, entry.slice(2)].filter(Boolean).join('/') || undefined }) : githubSource(entry)
      if (!sameSource(selected, installation.source)) throw new UpdateError('The marketplace changed this plugin’s source. Review it in Copilot before updating.', 'source_changed')
      sha = sameSource({ ...selected!, path: undefined }, { ...market, path: undefined }) ? marketSha : await branch(installation.source)
    } else sha = await branch(installation.source)
    const manifest = await read(raw(installation.source, sha, identity.manifest))
    if (manifest?.name !== identity.name || compareVersions(manifest?.version, manifest?.version) !== 0) throw new UpdateError('The source plugin name or semantic version is invalid.', 'invalid_params')
    const hasChanges = await read(raw(installation.source, sha, identity.changelog), true).catch(() => false)
    return { version: manifest.version, ...(hasChanges ? { changes: `https://github.com/${installation.source.repo}/blob/${sha}/${installation.source.path ? installation.source.path + '/' : ''}${identity.changelog}` } : {}) }
  }
}
