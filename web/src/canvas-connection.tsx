import { useSyncExternalStore } from 'react'
import type { CanvasConnection } from '../../src/canvas-events.ts'
import { Button } from '@/components/ui/button'
import { LogsButton } from './logs'

let current: CanvasConnection = 'connected'
let retry = () => {}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => current
export function setCanvasConnection(next: CanvasConnection) { if (current !== next) { current = next; for (const listener of listeners) listener() } }
export function setCanvasRetry(action: () => void) { retry = action }

export function CanvasConnectionNotice() {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot)
  if (state === 'connected') return null
  return <aside className="rounded-lg border p-3 text-sm" aria-label="Canvas connection">
    <p role="status">{state === 'connecting' ? 'Connecting to the canvas…' : state === 'unavailable' ? 'This canvas connection is no longer available.' : 'Live progress and changes are disconnected.'}</p>
    <p className="mt-1 text-xs text-muted-foreground">{state === 'unavailable' ? 'Copy any unsaved text, then reopen Enhance Prompt from Copilot. If it remains unavailable, restart Copilot.' : 'Reconnecting only restores live events. It does not repeat enhancements or sends. Check the save status before closing.'}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {state !== 'unavailable' && <Button size="sm" variant="outline" disabled={state === 'connecting'} onClick={() => retry()}>Retry connection</Button>}
      <LogsButton />
    </div>
  </aside>
}
