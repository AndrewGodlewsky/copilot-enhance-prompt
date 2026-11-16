import { read } from '#panel'
import { CheckCircle2Icon, RotateCcwIcon } from 'lucide-react'
import { busy } from '../../src/panel/state.ts'
import { retryCopilot } from '../../src/panel/actions.ts'
import { copilotStatus } from '../../src/panel/copilot-status.ts'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { LogsButton } from './logs'

export function CopilotConnection() {
  const status = copilotStatus()
  return <div className={`rounded-lg border px-3 py-2 text-xs ${status.kind === 'error' ? 'border-warning-foreground/40 bg-warning/10' : 'bg-muted/30'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-medium">{status.kind === 'ready' ? <CheckCircle2Icon aria-hidden="true" className="size-4 text-success-foreground" /> : null}{status.title}</p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={status.kind === 'checking' || read(busy) !== null} onClick={() => void retryCopilot()}>
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
