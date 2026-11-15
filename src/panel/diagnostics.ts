import { plugin } from '#panel'
import { createDiagnostics, diagnosticError, type WorkerDiagnostics } from '../diagnostics.ts'
import { BRAND } from '../brand.ts'

export const panelDiagnostics = createDiagnostics()

export async function collectDiagnostics(): Promise<{ text: string; connected: boolean }> {
  let worker: WorkerDiagnostics | null = null
  try { worker = await plugin.request('logs.get', undefined, { timeoutMs: 5000 }) }
  catch (error) { panelDiagnostics.record('canvas.request', 'failed', diagnosticError(error)) }
  return { connected: worker !== null, text: JSON.stringify({ plugin: BRAND, ...panelDiagnostics.snapshot(), worker }, null, 2) }
}
