import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../../src/brand.ts'
import { REPOSITORY_URL, ISSUES_URL } from '../../src/panel/view.ts'
import { collectDiagnostics, panelDiagnostics } from '../../src/panel/diagnostics.ts'
import { diagnosticError } from '../../src/diagnostics.ts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { WhatsNew } from './whats-new'

const linkStyle = 'inline-flex min-h-8 items-center rounded px-1 text-xs text-blue-700 underline-offset-4 hover:underline dark:text-blue-400'

export function LogsButton() {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<Awaited<ReturnType<typeof collectDiagnostics>> | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!open) return
    let current = true
    setReport(null)
    setCopyStatus('')
    void collectDiagnostics().then(value => { if (current) setReport(value) })
    return () => { current = false }
  }, [open])
  async function copyLogs() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.text)
      setCopyStatus('Copied to clipboard.')
    } catch (error) {
      panelDiagnostics.record('clipboard', 'failed', diagnosticError(error))
      area.current?.focus()
      area.current?.select()
      setCopyStatus('Clipboard access is unavailable. The logs are selected; copy them with Ctrl+C or Command+C.')
    }
  }
  return <>
    <button type="button" className={linkStyle} onClick={() => setOpen(true)}>{'Show Logs'}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{'Diagnostic logs'}</DialogTitle>
          <DialogDescription>{'Reproduce the problem, then open these logs and copy them into your issue. They contain recent operation results and error codes, without prompts, file contents, paths, account names, or API keys. Nothing is uploaded automatically.'}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{'Up to 200 events per component are kept in memory. Restarting clears them. Reopen this dialog to capture newer events.'}</p>
        {report && !report.connected ? <p role="alert" className="text-sm text-destructive-foreground">{'The worker could not be reached. These logs include panel diagnostics only.'}</p> : null}
        {report ? <details className="rounded border p-2 text-xs">
          <summary className="cursor-pointer font-medium">{'Copilot model discovery'}</summary>
          <p className="mt-2 text-muted-foreground">{'Refresh the Copilot model list first, then reopen these logs. This section is included when you copy the logs.'}</p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">{report.discovery}</pre>
        </details> : null}
        <Textarea ref={area} aria-label={'Diagnostic logs'} readOnly value={report?.text ?? ''} placeholder={'Collecting logs…'} className="h-64 min-h-24 resize-none font-mono text-xs" spellCheck={false} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="flex-1 text-xs text-muted-foreground">{copyStatus}</p>
          <Button type="button" disabled={!report} onClick={() => void copyLogs()}>{'Copy logs'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
}

export function Footer({ onSettings }: { onSettings: () => void }) {
  return <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs">
    <a className={linkStyle} href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">{BRAND}</a>
    <WhatsNew />
    <button type="button" className={linkStyle} onClick={onSettings}>{'Settings'}</button>
    <LogsButton />
    <a className={linkStyle} href={ISSUES_URL} target="_blank" rel="noopener noreferrer">{'Feedback'}</a>
  </footer>
}
