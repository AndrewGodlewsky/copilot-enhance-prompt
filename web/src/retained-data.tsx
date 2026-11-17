import { useEffect, useRef, useState } from 'react'
import { frame, read, set } from '#panel'
import { busy } from '../../src/panel/state.ts'
import type { RetainedView, StoredSize } from '../../src/copilot/retained-data.ts'
import { Button } from '@/components/ui/button'
import { Group, Row } from './common'

const bytes = (value:number) => value >= 1024*1024 ? `${(value/1024/1024).toFixed(1)} MiB` : value >= 1024 ? `${(value/1024).toFixed(1)} KiB` : `${value} B`
const sizeText = (value:StoredSize) => `${value.partial ? 'At least ' : ''}${bytes(value.bytes)} · ${value.files} files${value.partial ? ' (incomplete)' : ''}`

export function StorageReport({view,working,onClear}:{view:RetainedView;working:boolean;onClear:()=>void}) {
  const [restarted,setRestarted] = useState(false)
  useEffect(()=>setRestarted(false),[view])
  const rows: [string,StoredSize][] = [
    ['Current session',view.sessions.current],['Other active workers',view.sessions.active],
    ['Known inactive sessions',view.sessions.inactive],['Unverified sessions',view.sessions.unknown],
    ['Shared preferences, rules, models and history',view.shared],['Upload copies (shared temporary folder)',view.uploads],
    ['Usage receipts',view.usage],['Usage recovery metadata',view.recovery],['Other plugin files and metadata (preserved)',view.other]
  ]
  return <>
    <Row>
      <dl className="space-y-2 text-xs">{rows.map(([label,size])=><div key={label} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><dt>{label}</dt><dd className="text-muted-foreground tabular-nums">{sizeText(size)}</dd></div>)}</dl>
      {view.history && <p className="text-xs text-muted-foreground">History: {view.history.entries} entries, {bytes(view.history.bytes)} of JSON within the shared files above.</p>}
      <p className="text-xs text-muted-foreground">Sizes are local file bytes, not disk allocation. Incomplete counts omit unreadable, linked or unscanned items. Recovery metadata excludes raw helper journals in temporary folders.</p>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer min-h-8 py-1">Storage locations</summary><p className="break-all">Plugin data: {view.location}</p><p className="break-all">Upload copies: {view.uploadLocation}</p></details>
    </Row>
    <Row>
      <p className="text-xs">Cleanup removes saved request/result text, context and attachment references from only the previewed inactive sessions. It preserves their control preferences, all active sessions, shared history/rules/models and usage accounting. We do not delete uploads or recovery journals here.</p>
      <p className="text-xs text-muted-foreground">Older sessions without reliable worker records, live or inaccessible processes, changed files and corrupt data stay protected. No automatic expiry is enabled. Up to 100 eligible sessions are offered per inspection.</p>
      {view.cleanup ? <>
        <p className="text-sm">Clear {view.cleanup.count} inactive drafts, about {bytes(view.cleanup.bytes)}. This cannot be undone.</p>
        <details className="text-xs"><summary className="min-h-8 cursor-pointer py-1">Review the {view.cleanup.count} session files</summary><ul className="max-h-48 overflow-auto space-y-2 pr-2">{view.cleanup.sessions.map(session=><li key={session.id} className="break-words">Storage ID {session.id} · {bytes(session.bytes)} · last saved {new Date(session.updatedAt).toLocaleString('en-US')}</li>)}</ul></details>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={restarted} disabled={working} onChange={event=>setRestarted(event.target.checked)} /><span>I restarted Copilot after updating and closed any older Copilot instances. I understand this clears only the previewed inactive drafts.</span></label>
        <Button size="sm" variant="destructive" className="self-start" disabled={working || !restarted} onClick={onClear}>Clear {view.cleanup.count} inactive drafts</Button>
        <p className="text-xs text-muted-foreground">Preview expires after five minutes. Sessions and files are checked again before each change.</p>
      </> : <p className="text-xs">No safely removable inactive drafts were found in this inspection. Unverified sessions require maintainer-assisted review.</p>}
    </Row>
  </>
}

export function RetainedData() {
  const client = frame().retained
  const [view,setView] = useState<RetainedView | null>(null), [working,setWorking] = useState(false), [message,setMessage] = useState('')
  const operation = useRef<AbortController | null>(null)
  useEffect(()=>()=>operation.current?.abort(),[])
  if (!client) return null
  const act = async (clear = false) => {
    if (working || clear && !view?.cleanup) return
    if (clear && read(busy)) { setMessage('Finish the current plugin operation before clearing inactive drafts.'); return }
    const token = view?.cleanup?.token
    const controller = new AbortController(); operation.current = controller
    setWorking(true); setMessage(''); if (clear) set(busy,'save'); else setView(null)
    try {
      if (clear) {
        const result = await client.clear(token!,true,controller.signal)
        setView(null)
        setMessage(`Cleared ${result.cleared} inactive drafts (${bytes(result.bytes)}); skipped ${result.skipped} changed or protected sessions.${result.failed ? ' A file could not be changed.' : ''}${result.cancelled ? ' Cleanup was interrupted.' : ''} Inspect again to review what remains.`)
      } else setView(await client.inspect(controller.signal))
    } catch (error) {
      setView(null)
      setMessage(controller.signal.aborted ? clear ? 'Cleanup interrupted. Some drafts may already be cleared. Inspect again before retrying.' : 'Inspection cancelled.' : error instanceof Error ? error.message : 'Unable to inspect stored data. Keep your saved files and try again.')
    } finally { operation.current = null; setWorking(false); if (clear && read(busy) === 'save') set(busy,null) }
  }
  return <Group title="Retained storage">
    <Row>
      <p className="text-xs text-muted-foreground">Inspect local storage and preview a limited cleanup of verified inactive drafts. This uses no model or external network service. Larger stores may produce an explicitly incomplete result.</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={working} onClick={()=>void act()}>{working ? 'Working…' : 'Inspect stored data'}</Button>{working && <Button size="sm" variant="outline" onClick={()=>operation.current?.abort()}>Cancel</Button>}</div>
      {message && <p role="status" className="text-xs">{message}</p>}
    </Row>
    {view && <StorageReport view={view} working={working} onClear={()=>void act(true)} />}
  </Group>
}
