import { basename, isAbsolute } from 'node:path'
import { realpath, stat } from 'node:fs/promises'
import type { EnhanceWorker, PlatformOperations } from '../host.ts'
import type { RequestOptions } from '../runtime.ts'
import { msg, withMessage } from '../messages.ts'

/** The narrow SDK surface used here; validated against the desktop SDK in docs/copilot-migration-assessment.md. */
export type CopilotSession = {
  sessionId: string
  rpc: {
    metadata: {
      snapshot(): Promise<{ workingDirectory: string; isRemote: boolean; initialName?: string }>
      activity(): Promise<{ hasActiveWork: boolean }>
      isProcessing(): Promise<{ processing: boolean }>
    }
    permissions: { pendingRequests(): Promise<{ items: unknown[] }> }
    queue: { pendingItems(): Promise<{ items: unknown[]; steeringMessages: string[] }> }
  }
  send(options: { prompt: string; mode: 'enqueue' }): Promise<string>
}

const unavailable = (message: string) => Object.assign(new Error(message), { code: 'unavailable' })
async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(unavailable('Copilot did not respond.')), 3000)
    })])
  } finally { clearTimeout(timer) }
}
export function sessionAdapter(session: CopilotSession): EnhanceWorker['host'] & { state(): Promise<string>; project(): Promise<{ id: string; path: string; name: string } | null> } {
  let sending = false
  let lastSent = 0
  const project = async () => {
    try {
      const info = await bounded(session.rpc.metadata.snapshot())
      if (!info || info.isRemote !== false || typeof info.workingDirectory !== 'string' || !isAbsolute(info.workingDirectory)) return null
      const path = await realpath(info.workingDirectory)
      if (!(await stat(path)).isDirectory()) return null
      return { id: `copilot::${path}`, path, name: basename(path) }
    } catch { return null }
  }
  const state = async () => {
    try {
      const [activity, processing, permissions, queue] = await bounded(Promise.all([
        session.rpc.metadata.activity(), session.rpc.metadata.isProcessing(), session.rpc.permissions.pendingRequests(), session.rpc.queue.pendingItems()
      ]))
      if (!Array.isArray(permissions.items) || !Array.isArray(queue.items) || !Array.isArray(queue.steeringMessages) || typeof activity.hasActiveWork !== 'boolean' || typeof processing.processing !== 'boolean') return 'unknown'
      if (permissions.items.length) return 'blocked'
      if (activity.hasActiveWork || processing.processing || queue.items.length || queue.steeringMessages.length) return 'working'
      return 'waiting'
    } catch { return 'unknown' }
  }
  const operations = new Set(['workspace.list', 'workspace.readContext', 'agents.list', 'session.send'])
  return {
    has: name => operations.has(name), state, project,
    async call<K extends keyof PlatformOperations>(name: K, input: PlatformOperations[K]['input'], options?: RequestOptions): Promise<PlatformOperations[K]['output']> {
      let result: unknown
      if (name === 'workspace.list') {
        const place = await project()
        result = { workspaces: place ? [{ ...place, project: place.path, branch: null, hostId: null }] : [] }
      } else if (name === 'workspace.readContext') {
        const place = await project()
        result = { displayName: place?.name ?? '', branch: '', terminals: [{ id: session.sessionId, title: 'GitHub Copilot' }], ...(place ? { workspaceId: place.id } : {}) }
      } else if (name === 'agents.list') {
        const place = await project()
        result = { agents: [{ terminalId: session.sessionId, title: 'GitHub Copilot', agent: 'copilot', state: await state(), stateStartedAt: Date.now(), ...(place ? { workspaceId: place.id } : {}) }] }
      } else if (name === 'session.send') {
        options?.signal?.throwIfAborted()
        const { sessionId, text } = input as PlatformOperations['session.send']['input']
        if (sessionId !== session.sessionId) throw unavailable('The canvas belongs to another Copilot session.')
        if (typeof text !== 'string' || !text.trim() || text.length > 1_000_000) throw unavailable('The prompt is empty or too large.')
        if (sending || Date.now() - lastSent < 3000) throw unavailable(withMessage(msg('error.send_pending')))
        sending = true
        try {
          const current = await state()
          options?.signal?.throwIfAborted()
          if (current !== 'waiting') throw Object.assign(new Error(withMessage(msg('error.session_not_idle'))), { code: 'session_not_idle' })
          // Never use immediate mode: a new message must not become a response to a pending question.
          await session.send({ prompt: text, mode: 'enqueue' })
          lastSent = Date.now()
        } finally { sending = false }
        result = { accepted: true }
      } else throw unavailable(`${name} is not available in the Copilot canvas.`)
      return result as PlatformOperations[K]['output']
    }
  }
}
