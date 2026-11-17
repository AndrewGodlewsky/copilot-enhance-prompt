import type { HistoryEntry } from '../history.ts'

export const HISTORY_PAGE_SIZE = 12
export type HistoryOrder = 'newest' | 'oldest'
export type HistoryProject = { value: string; path: string; name: string; label: string; detail: string; current: boolean; count: number }

const projectPath = (entry: HistoryEntry) => entry.project || ''
const matches = (entry: HistoryEntry, query: string) => entry.original.toLowerCase().includes(query) || entry.enhanced.toLowerCase().includes(query)

function pathLabel(path: string): { name: string; parent: string } {
  if (!path) return { name: 'No project recorded', parent: '' }
  const trimmed = path.replace(/[\\/]+$/, '')
  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return { name: trimmed.slice(slash + 1) || path, parent: trimmed.slice(0, Math.max(0, slash)) || (path.startsWith('/') ? '/' : '') }
}

/** Short labels are for display only. Separate worktrees and same-named folders keep their saved identities. */
export function historyProjects(entries: HistoryEntry[], current: string | null, query = ''): HistoryProject[] {
  const paths = [...new Set([...entries.map(projectPath), ...(current ? [current] : [])])]
  const search = query.trim().toLowerCase()
  const labels = new Map(paths.map(path => [path, pathLabel(path)]))
  const names = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const { name } of labels.values()) names.set(name, (names.get(name) ?? 0) + 1)
  for (const entry of entries) {
    if (!matches(entry, search)) continue
    const path = projectPath(entry)
    counts.set(path, (counts.get(path) ?? 0) + 1)
  }
  return paths.map(path => {
    const { name, parent } = labels.get(path)!
    const duplicate = names.get(name)! > 1
    return {
      value: path ? `path:${path}` : 'unassigned', path, name,
      label: duplicate ? `${name} (${parent})` : name,
      detail: duplicate ? parent : '', current: path === current,
      count: counts.get(path) ?? 0
    }
  }).sort((a, b) => Number(b.current) - Number(a.current) || Number(!a.path) - Number(!b.path) || a.label.localeCompare(b.label, 'en'))
}

/** null means all projects, '' means unassigned; keep the older current-project preference readable. */
export function resolveHistoryProject(scope: unknown, entries: HistoryEntry[], current: string | null): string | null {
  if (typeof scope !== 'string') return null
  if (scope === 'project') return entries.some(entry => entry.project) ? current : null
  const path = scope === 'unassigned' ? '' : scope.startsWith('path:') ? scope.slice(5) : null
  return path !== null && (path === current || entries.some(entry => projectPath(entry) === path)) ? path : null
}

export function filterHistory(entries: HistoryEntry[], query: string, project: string | null, order: HistoryOrder): HistoryEntry[] {
  const search = query.trim().toLowerCase()
  return entries.filter(entry => (project === null || projectPath(entry) === project) && matches(entry, search))
    .sort((a, b) => order === 'oldest' ? a.at - b.at : b.at - a.at)
}

export function pageHistory(entries: HistoryEntry[], requestedPage: number, selectedId: string | null) {
  const pages = Math.max(1, Math.ceil(entries.length / HISTORY_PAGE_SIZE))
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1))
  const start = (page - 1) * HISTORY_PAGE_SIZE
  const visible = entries.slice(start, start + HISTORY_PAGE_SIZE)
  return {
    entries: visible, page, pages, total: entries.length,
    start: entries.length ? start + 1 : 0, end: start + visible.length,
    selected: visible.find(entry => entry.id === selectedId) ?? null
  }
}

export function historyTitle(entry: HistoryEntry): string {
  const title = entry.original.split(/\r?\n/, 1)[0].trim()
  return title.length > 160 ? `${title.slice(0, 160)}…` : title || 'Untitled request'
}
export function historyExcerpt(entry: HistoryEntry): string {
  const excerpt = (entry.original.split(/\r?\n/).slice(1).join(' ').trim() || entry.enhanced).replace(/\s+/g, ' ')
  return excerpt.length > 240 ? `${excerpt.slice(0, 240)}…` : excerpt
}

/** Render literal matches as React text nodes; never turn saved prompts into HTML. */
export function historyMatchParts(text: string, query: string): { text: string; match: boolean }[] {
  if (!query.trim()) return [{ text, match: false }]
  const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const parts: { text: string; match: boolean }[] = []
  let from = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index), match: false })
    parts.push({ text: match[0], match: true })
    from = match.index + match[0].length
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return parts
}
