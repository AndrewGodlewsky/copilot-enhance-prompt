// Desktop-owned SDK/runtime only. No SDK package, runtime download, or executable preference.
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { basename, isAbsolute, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import type { Catalog } from '../catalog.ts'
import type { ImageType } from '../images.ts'
import { LlmError } from '../llm.ts'
import { msg } from '../messages.ts'

type Auth = { isAuthenticated: boolean; login?: string; host?: string }
type Model = { id: string; name?: string; provider?: { kind?: string }; policy?: { state?: string }; capabilities?: { supports?: { vision?: boolean } } }
export type ModelSession = { rpc: {
  model: { list(options?: { refresh?: boolean }): Promise<{ list: unknown[] }>; getCurrent(): Promise<{ modelId?: string }> }
  gitHubAuth: { getStatus(): Promise<Auth> }
  metadata: { snapshot(): Promise<{ workingDirectory: string; isRemote: boolean }> }
} }
type HelperSession = ModelSession & {
  rpc: ModelSession['rpc'] & { tools: { initializeAndValidate(): Promise<unknown>; getCurrentMetadata(): Promise<{ tools: unknown[] | null }> } }
  sendAndWait(input: { prompt: string; attachments: { type: 'blob'; data: string; mimeType: string }[] }, timeout: number): Promise<{ data: { content: string } } | undefined>
}
type Client = { start(): Promise<unknown>; createSession(config: Record<string, unknown>): Promise<HelperSession>; forceStop(): Promise<unknown> }
export type DesktopSdk = { CopilotClient: new (options: Record<string, unknown>) => Client; RuntimeConnection: { forStdio(options: { path: string; args: string[] }): unknown } }
export type CopilotRewrite = { model: string; system: string; user: string; images?: { type: ImageType; base64: string }[] }

const unavailable = () => new LlmError(msg('error.copilot_unavailable'), 'unavailable')
const cancelled = () => new LlmError(msg('error.cancelled'), 'cancelled')

export function hostRuntime(executable = process.execPath, argv = process.argv, parentPid = process.ppid, environment = process.env): string {
  if (!isAbsolute(executable) || !['copilot.exe', 'copilot', 'copilot-runtime.exe', 'copilot-runtime'].includes(basename(executable).toLowerCase()) ||
      !argv.some(arg => isAbsolute(arg) && basename(arg) === 'extension_bootstrap.mjs') ||
      !environment.COPILOT_SDK_PATH || String(parentPid) !== environment.COPILOT_EXTENSION_PARENT_PID) throw unavailable()
  return executable
}

// Keep normal OS/auth discovery; exclude code injection, provider overrides, host IPC, and tracing.
export function runtimeEnvironment(source = process.env): Record<string, string> {
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|XDG_CONFIG_HOME|XDG_CACHE_HOME|LANG|LC_ALL|GH_TOKEN|GITHUB_TOKEN|GH_HOST|GITHUB_HOST|GH_CONFIG_DIR|HTTPS_PROXY|HTTP_PROXY|ALL_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR)$/i
  return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => allowed.test(entry[0]) && typeof entry[1] === 'string'))
}

async function desktopRuntime(): Promise<{ sdk: DesktopSdk; path: string }> {
  const path = await realpath(hostRuntime())
  const name = '@github/copilot-sdk'
  const sdk: DesktopSdk = await import(name)
  if (typeof sdk.CopilotClient !== 'function' || typeof sdk.RuntimeConnection?.forStdio !== 'function') throw unavailable()
  return { sdk, path }
}

function eligible(value: unknown): value is Model {
  if (!value || typeof value !== 'object') return false
  const model = value as Model
  return typeof model.id === 'string' && model.id.length > 0 && model.provider?.kind === 'copilot' && (!model.policy || model.policy.state === 'enabled')
}

function sameAccount(left: Auth, right: Auth): boolean {
  return left.isAuthenticated === true && right.isAuthenticated === true && !!left.login && !!left.host &&
    left.login.toLowerCase() === right.login?.toLowerCase() && left.host.toLowerCase() === right.host?.toLowerCase()
}

// Dependency injection is used only by local fixture tests. Production always calls desktopRuntime.
export function createCopilotModels(parent: ModelSession, runtime = desktopRuntime) {
  const active = new Set<AbortController>()
  async function catalog(): Promise<Catalog> {
    try {
      await runtime()
      const result = await withDeadline(parent.rpc.model.list({ refresh: true }), 15_000)
      return { models: result.list.filter(eligible).map(model => ({ id: model.id, label: model.name || model.id })), source: 'GitHub Copilot', fetchedAt: Date.now() }
    } catch { throw unavailable() }
  }
  async function rewrite(input: CopilotRewrite, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw cancelled()
    const controller = new AbortController()
    active.add(controller)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 180_000)
    let client: Client | undefined
    let directory: string | undefined
    let stop: Promise<boolean> | undefined
    const stopClient = () => { if (client) stop ??= withDeadline(client.forceStop(), 10_000).then(() => true, () => false); return stop }
    controller.signal.addEventListener('abort', () => { void stopClient() }, { once: true })
    const check = () => { if (controller.signal.aborted) throw cancelled() }
    try {
      const { sdk, path } = await runtime()
      check()
      directory = await mkdtemp(join(tmpdir(), 'enhance-copilot-'))
      const workspace = join(directory, 'workspace')
      await mkdir(workspace)
      check()
      client = new sdk.CopilotClient({ mode: 'empty', workingDirectory: workspace, baseDirectory: join(directory, 'home'),
        connection: sdk.RuntimeConnection.forStdio({ path, args: ['--no-auto-update'] }),
        env: runtimeEnvironment(), useLoggedInUser: true, logLevel: 'error', builtinPluginDirectories: [] })
      await withDeadline(client.start(), 30_000)
      check()
      const session = await withDeadline(client.createSession({
        workingDirectory: workspace, configDirectory: join(directory, 'home'), model: input.model,
        systemMessage: { mode: 'replace', content: input.system },
        availableTools: [], onPermissionRequest: () => ({ kind: 'denied-by-rules', rules: [] }),
        requestExtensions: false, requestCanvasRenderer: false, pluginDirectories: [], mcpServers: {},
        enableConfigDiscovery: false, skipCustomInstructions: true, enableSkills: false, enableFileHooks: false,
        enableOnDemandInstructionDiscovery: false, enableSessionStore: false, enableHostGitOperations: false,
        skipEmbeddingRetrieval: true, embeddingCacheStorage: 'in-memory', enableSessionTelemetry: false,
        memory: { enabled: false }, skillDirectories: [], agentDirectories: [], instructionDirectories: [], hookDirectories: [],
        infiniteSessions: { enabled: false }, enableManagedSettings: true, enforceManagedModelDefaults: true
      }), 30_000)
      check()
      const [parentModels, helperModels, parentAuth, helperAuth, metadata] = await withDeadline(Promise.all([
        parent.rpc.model.list({ refresh: true }), session.rpc.model.list({ refresh: true }),
        parent.rpc.gitHubAuth.getStatus(), session.rpc.gitHubAuth.getStatus(), session.rpc.metadata.snapshot()
      ]), 20_000)
      if (!sameAccount(parentAuth, helperAuth)) throw new LlmError(msg('error.copilot_account'), 'unavailable')
      const model = helperModels.list.filter(eligible).find(model => model.id === input.model)
      if (!model || !parentModels.list.filter(eligible).some(model => model.id === input.model)) throw new LlmError(msg('error.copilot_model'), 'invalid_params')
      if (metadata.isRemote !== false || await realpath(metadata.workingDirectory) !== await realpath(workspace)) throw unavailable()
      await withDeadline(session.rpc.tools.initializeAndValidate(), 15_000)
      const [tools, selected] = await withDeadline(Promise.all([session.rpc.tools.getCurrentMetadata(), session.rpc.model.getCurrent()]), 15_000)
      if (!Array.isArray(tools.tools) || tools.tools.length !== 0 || selected.modelId !== input.model) throw unavailable()
      const images = input.images ?? []
      if (images.length && model.capabilities?.supports?.vision !== true) throw new LlmError(msg('error.copilot_images'), 'invalid_params')
      const [currentParent, currentHelper] = await withDeadline(Promise.all([parent.rpc.gitHubAuth.getStatus(), session.rpc.gitHubAuth.getStatus()]), 10_000)
      if (!sameAccount(parentAuth, currentParent) || !sameAccount(parentAuth, currentHelper)) throw new LlmError(msg('error.copilot_account'), 'unavailable')
      check()
      const result = await session.sendAndWait({ prompt: input.user, attachments: images.map(image => ({ type: 'blob', data: image.base64, mimeType: image.type })) }, 180_000)
      check()
      if (typeof result?.data?.content !== 'string' || !result.data.content.trim()) throw new LlmError(msg('error.empty_answer'), 'action_failed')
      return result.data.content
    } catch (error) {
      if (controller.signal.aborted) throw cancelled()
      // SDK exceptions can contain request text or credentials. Do not forward them to logs/UI/history.
      if (error instanceof LlmError) throw error
      throw unavailable()
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      const stopped = await stopClient()
      active.delete(controller)
      // Do not remove state while a helper might still be using it, or report success after a failed stop.
      if (stopped === false) throw unavailable()
      if (directory) {
        const inside = relative(tmpdir(), directory)
        if (inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(directory).startsWith('enhance-copilot-')) {
          await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => { throw unavailable() })
        }
      }
    }
  }
  return { catalog, rewrite, close() { for (const controller of active) controller.abort() } }
}

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), ms) })]) }
  finally { clearTimeout(timer) }
}
