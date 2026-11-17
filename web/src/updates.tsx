import { useEffect, useState } from 'react'
import { atom, frame, read, set } from '#panel'
import { busy, draft, files, mayKeep, result } from '../../src/panel/state.ts'
import type { UpdateView } from '../../src/updates/types.ts'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Group, Row } from './common'
import { uploadingNames } from './attach'

const updateView = atom<UpdateView | null>(null)
const updateError = atom('')
const updating = atom(false)
const installFeedback = atom(false)
async function act(operation: () => Promise<UpdateView>) {
  set(updateError, '')
  try { set(updateView, await operation()) }
  catch (error) { set(updateError, error instanceof Error ? error.message : 'Unable to contact the updater. Reopen the plugin to verify its installed version.') }
}
function Actions({ value }: { value: UpdateView }) {
  const privateDraft = !mayKeep() && (!!read(draft) || !!read(result) || read(files).length > 0)
  const uploading = uploadingNames().length > 0
  const install = async () => {
    if (read(busy) || privateDraft || uploadingNames().length || read(updating)) return
    set(updating, true); set(installFeedback, true); set(busy, 'save')
    try { await act(() => frame().updates!.install()) }
    finally { set(updating, false); set(busy, null) }
  }
  return <>
    <div className="flex flex-wrap gap-2">
      {value.changes && <Button size="sm" variant="outline" asChild><a href={value.changes} target="_blank" rel="noopener noreferrer">View changes</a></Button>}
      <Button size="sm" disabled={!value.canUpdate || !!read(busy) || privateDraft || uploading || read(updating)} onClick={() => void install()}>{read(updating) ? 'Updating…' : 'Update'}</Button>
      <Button size="sm" variant="ghost" disabled={read(updating)} onClick={() => void act(() => frame().updates!.later())}>Later</Button>
    </div>
    {privateDraft && <p className="text-xs text-muted-foreground">Draft saving is off. Copy any text you need, then Clear before updating; unsaved drafts cannot be carried into a new session.</p>}
    {!!read(busy) && !read(updating) && <p className="text-xs text-muted-foreground">Finish the current operation before updating.</p>}
    {uploading && <p className="text-xs text-muted-foreground">Wait for attachments to finish uploading before updating.</p>}
    {!value.canUpdate && <p className="text-xs text-muted-foreground">Use Copilot → Customize → Installed → Update for this installation.</p>}
    <p className="text-xs text-muted-foreground">Copilot updates from your configured source. Its branch can change after these release notes were checked; the installed version is verified afterward.</p>
  </>
}
export function UpdateNotice() {
  useEffect(() => {
    const client = frame().updates
    if (!client) return
    let alive = true
    const refresh = () => { void client.state().then(value => { if (alive) set(updateView, value) }).catch(() => {}) }
    // The initial render and normal panel setup never wait for update I/O.
    const start = setTimeout(() => { void client.check(false).then(value => { if (alive) set(updateView, value) }).catch(() => {}) }, 1500)
    const poll = setInterval(refresh, 5000)
    refresh()
    return () => { alive = false; clearTimeout(start); clearInterval(poll) }
  }, [])
  const value = read(updateView)
  const failed = read(installFeedback) && (['failed', 'unknown', 'unavailable'].includes(value?.status ?? '') || !!read(updateError))
  if (!value || !failed && (!['available', 'updating', 'reload'].includes(value.status) || value.status === 'available' && value.dismissed)) return null
  return <aside aria-label="Plugin update" className="rounded-lg border bg-muted/30 p-3 text-sm flex flex-col gap-2">
    <p role="status">{value.message}</p>
    {value.status === 'available' && <Actions value={value} />}
    {read(updateError) && <p role="alert">{read(updateError)}</p>}
    {failed && <Button size="sm" variant="outline" className="self-start" onClick={() => { set(installFeedback, false); set(updateError, '') }}>Dismiss</Button>}
  </aside>
}
export function UpdateSettings() {
  const [checking, setChecking] = useState(false)
  const value = read(updateView), client = frame().updates
  if (!client) return null
  return <Group title="Plugin updates">
    <Row title="Automatically check for updates" control={<Switch aria-label="Automatically check for updates" checked={value?.automatic !== false} onCheckedChange={enabled => void act(() => client.automatic(enabled))} />} />
    <p className="text-sm text-muted-foreground">Checks the installed source when you open the plugin, at most once every 24 hours. Installation always requires your Update click.</p>
    <div className="flex flex-col gap-2 p-3">
      <p role="status" className="text-sm">{value?.message ?? 'Update status has not been checked.'}</p>
      {value && <p className="text-xs text-muted-foreground">Running {value.running} · Installed {value.installed ?? 'unknown'} · Available {value.available ?? 'unknown'}</p>}
      {value?.checkedAt && <p className="text-xs text-muted-foreground">Last successful check: {new Date(value.checkedAt).toLocaleString('en-US')}</p>}
      <Button size="sm" variant="outline" className="self-start" disabled={checking || read(updating) || value?.status === 'updating'} onClick={async () => { setChecking(true); try { await act(() => client.check(true)) } finally { setChecking(false) } }}>{checking || value?.status === 'checking' ? 'Checking…' : 'Check for updates'}</Button>
      {value?.status === 'available' && <Actions value={value} />}
      {read(updateError) && <p role="alert" className="text-sm">{read(updateError)}</p>}
    </div>
  </Group>
}
