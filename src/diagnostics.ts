import { MESSAGES, messageIn } from './messages.ts'
import { VERSION } from './version.ts'

// Only these fields reach a support report. Never retain raw logs, inputs, results or error text.
const OPERATIONS = new Set([
  'worker.ready', 'canvas.connection', 'canvas.request', 'panel.start', 'panel.persistence', 'clipboard',
  'prompt.enhance', 'prompt.send', 'prompt.copy', 'context.preview', 'attachments.put',
  'models.get', 'models.save', 'models.delete', 'models.move', 'models.roles', 'models.test', 'models.catalog', 'models.detect',
  'history.remove', 'history.clear', 'history.restore', 'consents.get', 'consent.set', 'agent.launch', 'editor.open',
  'targets.list', 'ui.locale', 'hook.last', 'rules.get', 'rules.save', 'data.summary', 'data.clear',
  'copilot.catalog', 'copilot.runtime', 'copilot.start', 'copilot.session', 'copilot.access', 'copilot.workspace',
  'copilot.tools', 'copilot.images', 'copilot.account', 'copilot.generate', 'copilot.cleanup'
])
const CODES = new Set(['aborted', 'cancelled', 'timeout', 'unavailable', 'invalid_params', 'action_failed', 'rate_limited',
  'disconnected', 'request_failed', 'unauthorized', 'forbidden', 'network', 'AbortError', 'TimeoutError', 'NotAllowedError',
  ...Object.keys(MESSAGES).filter(code => code.startsWith('error.'))])
export type DiagnosticOutcome = 'started' | 'ok' | 'failed' | 'cancelled' | 'pending'
export type DiagnosticEntry = { at: string; operation: string; outcome: DiagnosticOutcome; ms?: number; code?: string; status?: number }
export type DiagnosticReport = { version: string; capturedAt: string; startedAt: string; limit: number; entries: DiagnosticEntry[] }
export type WorkerDiagnostics = DiagnosticReport & { platform: string; architecture: string; runtime: string }

export function diagnosticError(error: unknown): { code: string; status?: number } {
  const value = error as { text?: { code?: string; params?: { status?: unknown } }; code?: string; name?: string; message?: string; status?: number } | null
  const message = value?.text ?? (typeof value?.message === 'string' ? messageIn(value.message) : undefined)
  const code = [message?.code, value?.code, value?.name].find(code => typeof code === 'string' && CODES.has(code)) ?? 'request_failed'
  const status = value?.status ?? (message?.code === 'error.http' ? message.params?.status : undefined)
  return { code, ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}) }
}

export function createDiagnostics() {
  const entries: DiagnosticEntry[] = []
  const startedAt = new Date().toISOString()
  const limit = 200
  return {
    record(operation: string, outcome: DiagnosticOutcome, details: { ms?: number; code?: string; status?: number } = {}) {
      if (!OPERATIONS.has(operation) || !['started', 'ok', 'failed', 'cancelled', 'pending'].includes(outcome)) return
      const { ms, code, status } = details
      entries.push({ at: new Date().toISOString(), operation, outcome,
        ...(typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? { ms: Math.round(ms) } : {}),
        ...(typeof code === 'string' && CODES.has(code) ? { code } : {}),
        ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}) })
      if (entries.length > limit) entries.splice(0, entries.length - limit)
    },
    snapshot(): DiagnosticReport { return { version: VERSION, capturedAt: new Date().toISOString(), startedAt, limit, entries: entries.map(entry => ({ ...entry })) } }
  }
}

export type Diagnostics = ReturnType<typeof createDiagnostics>
