import { useEffect, useState } from 'react'
import { plugin, read } from '#panel'
import { busy } from '../../src/panel/state.ts'
import type { UsageRecoveryStatus } from '../../src/copilot/usage-recovery.ts'
import { Button } from '@/components/ui/button'
import { Group } from './common'

export function UsageRecovery() {
  const [status, setStatus] = useState<UsageRecoveryStatus | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    void plugin.request('usage.status').then(value => { if (current) setStatus(value) }).catch(() => { if (current) setError('Usage recovery status is unavailable. Check Show Logs and reopen the plugin.') })
    return () => { current = false }
  }, [])
  const retry = async () => {
    if (working || read(busy)) return
    setWorking(true); setError('')
    try { setStatus(await plugin.request('usage.recover', undefined, { timeoutMs: 120_000 })) }
    catch { setError('Usage recovery could not finish. Raw helper data was kept; check Show Logs and retry after resolving the storage problem.') }
    finally { setWorking(false) }
  }
  return <Group title="Usage accounting recovery">
    <div className="flex flex-col gap-2 p-3 text-sm">
      <p className="text-muted-foreground">Retries usage receipts from stopped helpers after a storage failure. No model calls or uploads are made. History deletion leaves this accounting intact.</p>
      <p role="status">{working ? 'Recovering usage receipts…' : status ? `${status.recovered} recovered; ${status.pending} awaiting recovery; ${status.unconfirmed} left untouched because safe recovery could not be confirmed.` : 'Checking local recovery status…'}</p>
      {!!status?.unconfirmed && <p className="text-muted-foreground">Some helpers may still be running, or their files could not be verified. Contact the maintainer if this remains after restarting Copilot. Do not delete their files to clear this count.</p>}
      {error && <p role="alert">{error}</p>}
      <Button size="sm" variant="outline" className="self-start" disabled={working || !!read(busy)} onClick={() => void retry()}>Retry usage recovery</Button>
    </div>
  </Group>
}
