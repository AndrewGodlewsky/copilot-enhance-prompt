import { useSyncExternalStore } from 'react'
import { persistence, read } from '#panel'
import { privacy } from '../../src/panel/state.ts'
import { Button } from '@/components/ui/button'

const idle = { pending: 0, failed: 0, phase: 'saved' as const }
const subscribe = () => () => {}
const snapshot = () => idle

export function SaveStatus() {
  const queue = persistence()
  const state = useSyncExternalStore(queue?.subscribe ?? subscribe, queue?.snapshot ?? snapshot, queue?.snapshot ?? snapshot)
  if (!queue) return null
  return <div role="status" aria-live="polite" className={`flex flex-wrap items-center gap-2 text-xs ${state.phase === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
    {state.phase === 'failed' ? <>
      <span>Save failed. Copy your text before closing, or retry.</span>
      <Button size="sm" variant="outline" onClick={() => { void queue.retry().catch(() => {}) }}>Retry save</Button>
    </> : <span>{state.phase === 'saving' ? 'Saving…' : read(privacy).saveHistory === false ? 'Draft saving is off' : 'Saved'}</span>}
  </div>
}
