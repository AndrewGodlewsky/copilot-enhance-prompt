import { atom, derived, read, set } from '#panel'
import { draft, result, resultFor, run, workspaceKey } from './state.ts'

export type ColorTheme = 'light' | 'dark'
// Shared storage is independent of session-scoped drafts and changing canvas URLs.
export const colorTheme = atom<ColorTheme | 'system'>('colorTheme', 'system', { persist: 'storage' })
export const systemDark = atom(false)
export const currentTheme = derived<ColorTheme>(() => {
  const preference = read(colorTheme)
  return preference === 'light' || preference === 'dark' ? preference : read(systemDark) ? 'dark' : 'light'
})
export function toggleTheme(): void { set(colorTheme, read(currentTheme) === 'dark' ? 'light' : 'dark') }

export type DeskTime = 'morning' | 'afternoon' | 'night'
export function deskTime(now: Date): DeskTime {
  const hour = now.getHours()
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'night'
}

export type DeskState = 'idle' | 'draft' | 'running' | 'ready' | 'error' | 'cancelled'
export const deskState = derived<DeskState>(() => {
  const input = read(draft).trim()
  if (!input) return 'idle'
  const active = read(run)
  const belongs = active?.prompt === input && active.workspace?.key === read(workspaceKey)
  if (belongs && active.status !== 'done') return active.status
  return read(result).trim() && read(resultFor) === input ? 'ready' : 'draft'
})
export const DESK_STATUS_LABELS: Record<DeskState, string> = {
  idle: 'A fresh page for your next idea',
  draft: 'Draft ready to enhance',
  running: 'Enhancing your request…',
  ready: 'Prompt ready to review',
  error: 'Enhancement failed',
  cancelled: 'Enhancement cancelled'
}
