import { isAbsolute } from 'node:path'
import activate, { readSettings, withHistory } from '../worker.ts'
import { staticParts } from '../context/index.ts'
import { createWorkerHost } from '../worker-host.ts'
import { terminalSafe } from '../prompts.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'
import { sentKey } from './sent.ts'

/** Replace only an unambiguous original span, retaining runtime-added context byte for byte. */
export async function rewriteTransformed(input: { prompt: string; transformedPrompt: string }, rewrite: () => Promise<string>) {
  const { prompt, transformedPrompt } = input
  const at = prompt ? transformedPrompt.indexOf(prompt) : -1
  if (at < 0 || transformedPrompt.indexOf(prompt, at + 1) >= 0) return {}
  try {
    const enhanced = terminalSafe(await rewrite()).trim()
    if (!enhanced || enhanced === prompt) return {}
    return { modifiedTransformedPrompt: transformedPrompt.slice(0, at) + enhanced + transformedPrompt.slice(at + prompt.length) }
  } catch { return {} }
}

export async function runPromptHook(input: Record<string, unknown>, directory?: string) {
  if (typeof input.sessionId !== 'string' || typeof input.cwd !== 'string' || !isAbsolute(input.cwd) ||
      typeof input.prompt !== 'string' || typeof input.transformedPrompt !== 'string' || input.agentId) return {}
  const { sessionId, cwd, prompt, transformedPrompt } = input as { sessionId: string; cwd: string; prompt: string; transformedPrompt: string }
  // Hook context is supplied by the runtime for this exact session. This process cannot send messages.
  const session: CopilotSession = {
    sessionId,
    rpc: {
      metadata: { snapshot: async () => ({ workingDirectory: cwd, isRemote: false }), activity: async () => ({ hasActiveWork: true }), isProcessing: async () => ({ processing: true }) },
      permissions: { pendingRequests: async () => ({ items: [] }) }, queue: { pendingItems: async () => ({ items: [], steeringMessages: [] }) }
    },
    send: async () => { throw new Error('A prompt hook cannot send a message.') }
  }
  const services = createServices(session, directory)
  const bypass = await services.storage.transaction!(async () => {
    const key = sentKey(sessionId, prompt)
    const until = await services.storage.get(key)
    if (until !== null) await services.storage.delete(key)
    return typeof until === 'number' && until > Date.now()
  })
  if (bypass) return {}
  const worker = createWorkerHost(services)
  activate(worker.api)
  try {
    const settings = await readSettings(worker.api)
    if (settings.autoEnhanceMode === 'off') return {}
    return await rewriteTransformed({ prompt, transformedPrompt }, async () => {
      if (settings.autoEnhanceMode === 'ai' && settings.autoEnhanceContext && settings.privacy.allowProjectFiles) {
        const project = await services.adapter.project()
        if (project) await staticParts(project.path, settings.extraContextFiles, true, settings.privacy.allowGit, undefined, undefined, settings)
      }
      const result = await worker.hooks.fire('agent.prompt.before', { prompt, terminalId: sessionId, agent: 'copilot' })
      const last = await worker.request('hook.last')
      if (last) await services.storage.set('panel:hookLast', last)
      await withHistory(async () => {})
      return result.event.prompt
    })
  } finally { await worker.deactivate() }
}
