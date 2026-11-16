import { MESSAGES, messageIn } from './messages.ts'
import { VERSION } from './version.ts'

// Only these fields reach a support report. Never retain raw logs, inputs, results or error text.
const OPERATIONS = new Set([
  'worker.ready', 'canvas.connection', 'canvas.request', 'panel.start', 'panel.persistence', 'clipboard',
  'context.research', 'context.research.round', 'context.research.read', 'context.research.search',
  'prompt.enhance', 'prompt.send', 'prompt.copy', 'context.preview', 'attachments.put',
  'models.get', 'models.save', 'models.delete', 'models.move', 'models.roles', 'models.test', 'models.catalog',
  'history.remove', 'history.clear', 'history.restore', 'consents.get', 'consent.set', 'editor.open',
  'targets.list', 'rules.get', 'rules.save', 'data.summary', 'data.clear',
  'copilot.refresh', 'copilot.catalog', 'copilot.runtime', 'copilot.start', 'copilot.session', 'copilot.access', 'copilot.workspace',
  'copilot.reasoning', 'copilot.tools', 'copilot.images', 'copilot.account', 'copilot.generate', 'copilot.usage', 'copilot.cleanup'
])
const CODES = new Set(['aborted', 'cancelled', 'timeout', 'unavailable', 'invalid_params', 'action_failed', 'rate_limited',
  'disconnected', 'request_failed', 'unauthorized', 'forbidden', 'network', 'AbortError', 'TimeoutError', 'NotAllowedError',
  'ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_REQUIRE_ESM', 'ENOENT', 'EACCES', 'EPERM',
  ...Object.keys(MESSAGES).filter(code => code.startsWith('error.'))])
export type DiagnosticOutcome = 'started' | 'ok' | 'failed' | 'cancelled' | 'pending'
export type DiagnosticEntry = { at: string; operation: string; outcome: DiagnosticOutcome; ms?: number; code?: string; status?: number }
const DISCOVERY_STAGES = ['runtime_identity', 'runtime_path', 'sdk_import', 'sdk_api', 'session_api', 'authentication', 'model_list', 'filter', 'complete', 'privacy'] as const
const DISCOVERY_CHECKS = ['executableAllowed', 'bootstrapPresent', 'bootstrapEmbedded', 'sdkPathPresent', 'parentMatches', 'extensionSandboxed', 'runtimePathResolved', 'sdkImported', 'clientAvailable', 'stdioAvailable', 'modelListAvailable', 'responseIsList', 'authenticated'] as const
const DISCOVERY_COUNTS = ['received', 'eligible', 'invalid', 'otherProvider', 'unattributed', 'policyBlocked'] as const
export type ModelDiscovery = {
  attempt: number; startedAt: string; completedAt?: string; stage: typeof DISCOVERY_STAGES[number]
  outcome: 'running' | 'ok' | 'empty' | 'failed'
  checks: Partial<Record<typeof DISCOVERY_CHECKS[number], boolean>>
  counts: Partial<Record<typeof DISCOVERY_COUNTS[number], number>>
  failure?: { code: string; status?: number; rpcCode?: number }
}
export type DiagnosticReport = { version: string; capturedAt: string; startedAt: string; limit: number; entries: DiagnosticEntry[]; copilotModelDiscovery: ModelDiscovery | null }
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
  let discovery: ModelDiscovery | null = null
  let attempts = 0
  const startedAt = new Date().toISOString()
  const limit = 200
  return {
    beginModelDiscovery() {
      const current: ModelDiscovery = { attempt: ++attempts, startedAt: new Date().toISOString(), stage: 'runtime_identity', outcome: 'running', checks: {}, counts: {} }
      discovery = current
      return {
        stage(value: ModelDiscovery['stage']) { if (current.outcome === 'running' && DISCOVERY_STAGES.includes(value)) current.stage = value },
        check(key: typeof DISCOVERY_CHECKS[number], value: boolean) { if (current.outcome === 'running' && DISCOVERY_CHECKS.includes(key) && typeof value === 'boolean') current.checks[key] = value },
        count(key: typeof DISCOVERY_COUNTS[number], value: number) { if (current.outcome === 'running' && DISCOVERY_COUNTS.includes(key) && Number.isSafeInteger(value) && value >= 0) current.counts[key] = value },
        finish(outcome: 'ok' | 'empty' | 'failed', error?: unknown) {
          if (current.outcome !== 'running' || !['ok', 'empty', 'failed'].includes(outcome)) return
          current.outcome = outcome
          current.completedAt = new Date().toISOString()
          if (error) {
            const code = (error as { code?: unknown }).code
            current.failure = { ...diagnosticError(error), ...([-32700, -32600, -32601, -32602, -32603, -32000].includes(code as number) ? { rpcCode: code as number } : {}) }
          }
        }
      }
    },
    record(operation: string, outcome: DiagnosticOutcome, details: { ms?: number; code?: string; status?: number } = {}) {
      if (!OPERATIONS.has(operation) || !['started', 'ok', 'failed', 'cancelled', 'pending'].includes(outcome)) return
      const { ms, code, status } = details
      entries.push({ at: new Date().toISOString(), operation, outcome,
        ...(typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? { ms: Math.round(ms) } : {}),
        ...(typeof code === 'string' && CODES.has(code) ? { code } : {}),
        ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}) })
      if (entries.length > limit) entries.splice(0, entries.length - limit)
    },
    snapshot(): DiagnosticReport { return { version: VERSION, capturedAt: new Date().toISOString(), startedAt, limit, entries: entries.map(entry => ({ ...entry })), copilotModelDiscovery: discovery ? structuredClone(discovery) : null } }
  }
}

export type Diagnostics = ReturnType<typeof createDiagnostics>
export type DiscoveryProbe = ReturnType<Diagnostics['beginModelDiscovery']>
