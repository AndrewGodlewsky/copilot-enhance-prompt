import { atom, plugin, set } from '#panel'

export const removedHistory = atom<{ id: string; label: string; expiresAt: number }[]>([])
export const recoveryError = atom(false)
let pending: Promise<void> | undefined
let refreshAgain = false

export function refreshRemovedHistory(): Promise<void> {
  refreshAgain = true
  if (pending) return pending
  pending = (async () => {
    do {
      refreshAgain = false
      try {
        const { entries } = await plugin.request('history.removed')
        if (refreshAgain) continue
        set(removedHistory, entries)
        set(recoveryError, false)
      } catch {
        if (refreshAgain) continue
        set(removedHistory, [])
        set(recoveryError, true)
      }
    } while (refreshAgain)
  })().finally(() => { pending = undefined })
  return pending
}
