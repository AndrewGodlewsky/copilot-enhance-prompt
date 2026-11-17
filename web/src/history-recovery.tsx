import { useEffect, useState, useSyncExternalStore } from 'react'
import { read, subscribe, version } from '#panel'
import { runNoticeAction } from '../../src/panel/actions.ts'
import { isExpired, watchExpiry } from '../../src/panel/expiry.ts'
import { removedHistory, recoveryError, refreshRemovedHistory } from '../../src/panel/history-recovery.ts'
import { historyRaw } from '../../src/panel/state.ts'
import { Button } from '@/components/ui/button'

export function UndoHistory({ id, expiresAt, label = 'Undo', onDone }: { id: string; expiresAt: number; label?: string; onDone?: () => void }) {
  // Toasts live outside the App subscription; they must observe invalidation too.
  useSyncExternalStore(subscribe, version, version)
  const available = read(removedHistory).some(entry => entry.id === id && entry.expiresAt === expiresAt)
  const currentHistory = read(historyRaw)
  const [expired, setExpired] = useState(() => isExpired(expiresAt))
  const [pending, setPending] = useState(false)
  useEffect(() => { void refreshRemovedHistory() }, [currentHistory])
  useEffect(() => {
    setExpired(isExpired(expiresAt))
    return watchExpiry(expiresAt, () => setExpired(true), {
      now: Date.now,
      schedule: (callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer) },
      onResume: callback => {
        const resume = () => { callback(); void refreshRemovedHistory() }
        document.addEventListener('visibilitychange', resume)
        window.addEventListener('focus', resume)
        return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume) }
      }
    })
  }, [expiresAt])
  const name = expired ? 'Undo expired' : !available ? 'Undo unavailable' : pending ? 'Restoring…' : 'Undo'
  return <Button type="button" variant="outline" size="sm" disabled={expired || pending || !available} aria-label={expired || !available ? name : label} onClick={async () => {
    setPending(true)
    try { await runNoticeAction({ kind: 'history.restore', id, expiresAt }); onDone?.() }
    finally { setPending(false) }
  }}>{name}</Button>
}

export function RecentlyDeleted() {
  const entries = read(removedHistory)
  const failed = read(recoveryError)
  const currentHistory = read(historyRaw)
  useEffect(() => { void refreshRemovedHistory() }, [currentHistory])
  useEffect(() => {
    const refresh = () => void refreshRemovedHistory()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return <details className="rounded-md border p-3 text-sm">
    <summary className="cursor-pointer font-medium">Recently deleted{entries.length ? ` (${entries.length})` : ''}</summary>
    <p className="mt-2 text-muted-foreground">Individual deletions can be undone for one minute in this plugin session. Up to ten prompts can wait here. Clear history and restarting the plugin end recovery.</p>
    {failed ? <div className="mt-2"><p>Recovery could not be checked.</p><Button size="sm" variant="outline" onClick={() => void refreshRemovedHistory()}>Retry recovery</Button></div>
      : !entries.length ? <p className="mt-2 text-muted-foreground">No prompts available to restore.</p>
      : <ul className="mt-2 grid gap-2">{entries.map(entry => <li key={entry.id} className="flex items-center justify-between gap-3"><span className="min-w-0 break-words">{entry.label || 'Untitled request'}</span><UndoHistory {...entry} label={`Undo deletion of ${entry.label || 'untitled request'}`} /></li>)}</ul>}
  </details>
}
