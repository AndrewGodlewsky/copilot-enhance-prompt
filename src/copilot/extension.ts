import { fileURLToPath } from 'node:url'
import activate, { cancelPanelRuns } from '../worker.ts'
import { createWorkerHost } from '../worker-host.ts'
import { createServices } from './services.ts'
import { createCanvasServer } from './server.ts'

// Supplied by the desktop extension host. Never bundle or start a second Copilot client.
const SDK = '@github/copilot-sdk/extension'
const { joinSession, createCanvas } = await import(SDK)
let ready!: () => void
const initialized = new Promise<void>(resolve => { ready = resolve })
let services: ReturnType<typeof createServices>
let worker: ReturnType<typeof createWorkerHost>
let server: Awaited<ReturnType<typeof createCanvasServer>>

const canvas = createCanvas({
  id: 'enhance-prompt', displayName: 'Enhance Prompt',
  description: 'Rewrite a prompt with project context, model chains, and reusable rules. The user reviews and sends from the panel.',
  inputSchema: { type: 'object', properties: { prompt: { type: 'string', maxLength: 100000 } }, additionalProperties: false },
  // No agent-callable send, consent, credential or configuration actions are exposed.
  async open(context: { sessionId: string; instanceId: string; input?: { prompt?: unknown } }) {
    await initialized
    if (context.sessionId !== session.sessionId) throw new Error('This canvas belongs to another session.')
    if (typeof context.input?.prompt === 'string' && context.input.prompt.length <= 100_000 && await services.storage.get('panel:draft') === null) {
      if (await services.settings.get('saveHistory')) await services.storage.set('panel:draft', context.input.prompt)
    }
    return { url: server.open(context.instanceId), title: 'Enhance Prompt' }
  },
  async onClose(context: { instanceId: string }) { await initialized; server.closeCanvas(context.instanceId) }
})

const session = await joinSession({ canvases: [canvas] })
services = createServices(session)
process.stderr.write('[Enhance Prompt] Session connected.\n')
worker = createWorkerHost(services, message => process.stderr.write(`[Enhance Prompt] ${message}\n`))
activate(worker.api)
server = await createCanvasServer({ worker, assets: fileURLToPath(new URL('./web/', import.meta.url)), onClose: cancelPanelRuns })
ready()
process.stderr.write('[Enhance Prompt] Canvas server ready.\n')

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  cancelPanelRuns()
  await server.close()
  await worker.deactivate()
  await session.disconnect().catch(() => {})
}
process.once('SIGTERM', () => { void stop() })
process.once('SIGINT', () => { void stop() })
