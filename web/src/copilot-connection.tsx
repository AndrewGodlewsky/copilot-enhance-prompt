import { read, update } from '#panel'
import { CheckCircle2Icon, ChevronDownIcon, RotateCcwIcon } from 'lucide-react'
import { busy, copilotDetailsOpen } from '../../src/panel/state.ts'
import { retryCopilot } from '../../src/panel/actions.ts'
import { copilotStatus } from '../../src/panel/copilot-status.ts'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LogsButton } from './logs'

export function CopilotConnectionIndicator() {
  const status = copilotStatus()
  const expanded = read(copilotDetailsOpen)
  if (status.kind === 'error') return null
  const label = status.kind === 'ready' ? 'Connected' : 'Checking…'
  return <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-1.5 text-xs"
    aria-label={`${label}: ${expanded ? 'hide' : 'show'} connection details`}
    aria-expanded={expanded} aria-controls={expanded ? 'copilot-connection-details' : undefined}
    title="Copilot account and model access. Open for connection checks and logs."
    onClick={() => update(copilotDetailsOpen, value => !value)}>
    {status.kind === 'ready' ? <CheckCircle2Icon aria-hidden="true" className="size-3.5 text-success-foreground" /> : <Spinner className="size-3.5" />}
    {label}<ChevronDownIcon aria-hidden="true" className={`size-3 ${expanded ? 'rotate-180' : ''}`} />
  </Button>
}

export function CopilotConnection({ onCheck }: { onCheck?: () => void } = {}) {
  const status = copilotStatus()
  return <div className={`rounded-lg border px-3 py-2 text-xs ${status.kind === 'error' ? 'border-warning-foreground/40 bg-warning/10' : 'bg-muted/30'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-medium">{status.kind === 'ready' ? <CheckCircle2Icon aria-hidden="true" className="size-4 text-success-foreground" /> : null}{status.title}</p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={status.kind === 'checking' || read(busy) !== null} onClick={() => { onCheck?.(); void retryCopilot() }}>
          {status.kind === 'checking' ? <Spinner /> : <RotateCcwIcon className="size-3.5" />}{status.actionLabel}
        </Button>
        <LogsButton />
      </div>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true" className="mt-1 leading-relaxed">
      <p className="text-muted-foreground">{status.detail}</p>
      {status.feedback ? <p className="mt-1">{status.feedback}</p> : null}
    </div>
  </div>
}
