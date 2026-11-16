import { plugin, read } from '#panel'
import { createDiagnostics, diagnosticError, type WorkerDiagnostics } from '../diagnostics.ts'
import { BRAND } from '../brand.ts'
import { form, catalogs, catalogLoading, effectiveEffort, effortModels, effortReasoning, copilotRunFailure } from './state.ts'
import { copilotStatus } from './copilot-status.ts'

export const panelDiagnostics = createDiagnostics()

export async function collectDiagnostics(): Promise<{ text: string; connected: boolean; discovery: string }> {
  let worker: WorkerDiagnostics | null = null
  try { worker = await plugin.request('logs.get', undefined, { timeoutMs: 5000 }) }
  catch (error) { panelDiagnostics.record('canvas.request', 'failed', diagnosticError(error)) }
  const catalog = read(catalogs).form
  const effort = read(effectiveEffort)
  const reasoning = read(effortReasoning)[effort]
  const status = copilotStatus()
  const discovery = {
    worker: worker?.copilotModelDiscovery ?? null,
    panel: { copilotFormOpen: read(form) !== null, loading: read(catalogLoading).form === true,
      modelCount: catalog?.models.length ?? 0, modelSelected: Boolean(read(form)?.model),
      ...(catalog?.error ? { failure: diagnosticError({ text: catalog.errorText }) } : {}) },
    enhance: { status: status.kind, effort, recommended: read(effortModels)[effort] === 'recommended',
      reasoning: ['default', 'highest', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoning) ? reasoning : 'model-specific',
      modelCount: read(catalogs).copilot?.models.length ?? 0,
      ...(status.code ? { failure: diagnosticError({ text: { code: status.code } }) } : {}),
      ...(read(copilotRunFailure) ? { lastBackgroundFailure: diagnosticError({ text: read(copilotRunFailure)!.text }) } : {}) }
  }
  return { connected: worker !== null, discovery: JSON.stringify(discovery, null, 2),
    text: JSON.stringify({ plugin: BRAND, ...panelDiagnostics.snapshot(), copilotModelDiscovery: discovery, worker }, null, 2) }
}
