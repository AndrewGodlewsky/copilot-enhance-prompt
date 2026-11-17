// Desktop-owned SDK/runtime only. No SDK package, runtime download, or executable preference.
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { basename, isAbsolute, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { Catalog } from '../catalog.ts'
import { validReasoning } from '../effort.ts'
import type { ImageType } from '../images.ts'
import { LlmError } from '../llm.ts'
import { msg } from '../messages.ts'
import { diagnosticError, type Diagnostics, type DiscoveryProbe } from '../diagnostics.ts'
import { createUsageRecorder, reconcileUsageJournal, type UsageRecorder } from './usage.ts'

type Auth = { isAuthenticated: boolean; login?: string; host?: string }
type Model = { id: string; name?: string; provider?: { kind?: string }; policy?: { state?: string }; capabilities?: { supports?: { vision?: boolean; reasoningEffort?: boolean; reasoning_effort?: unknown } }; supportedReasoningEfforts?: unknown; defaultReasoningEffort?: unknown }
export type ModelSession = { rpc: {
  model: { list(options?: { refresh?: boolean }): Promise<{ list: unknown[] }>; getCurrent(): Promise<{ modelId?: string; reasoningEffort?: string }> }
  gitHubAuth: { getStatus(): Promise<Auth> }
  metadata: { snapshot(): Promise<{ workingDirectory: string; isRemote: boolean }> }
} }
type HelperSession = ModelSession & {
  sessionId: string
  rpc: ModelSession['rpc'] & { tools: { initializeAndValidate(): Promise<unknown>; getCurrentMetadata(): Promise<{ tools: unknown[] | null }> } }
  sendAndWait(input: { prompt: string; attachments: { type: 'blob'; data: string; mimeType: string }[] }, timeout: number): Promise<{ data: { content: string } } | undefined>
}
type Client = { start(): Promise<unknown>; createSession(config: Record<string, unknown>): Promise<HelperSession>; forceStop(): Promise<unknown> }
export type DesktopSdk = { CopilotClient: new (options: Record<string, unknown>) => Client; RuntimeConnection: { forStdio(options: { path: string; args: string[] }): unknown } }
export type CopilotRewrite = { model: string; reasoningEffort?: string; system: string; user: string; images?: { type: ImageType; base64: string }[] }

const unavailable = () => new LlmError(msg('error.copilot_unavailable'), 'unavailable')
const cancelled = () => new LlmError(msg('error.cancelled'), 'cancelled')
const usageFailed = () => new LlmError(msg('error.copilot_usage'), 'action_failed')

export function hostRuntime(executable = process.execPath, argv = process.argv, parentPid = process.ppid, environment = process.env, probe?: DiscoveryProbe): string {
  const checks = {
    executableAllowed: isAbsolute(executable) && ['copilot.exe', 'copilot', 'copilot-runtime.exe', 'copilot-runtime'].includes(basename(executable).toLowerCase()),
    // The packaged desktop uses a built-in entry name; SDK launches can use the preload's absolute path.
    bootstrapPresent: argv.some(arg => arg === 'extension_bootstrap.mjs' || (isAbsolute(arg) && basename(arg) === 'extension_bootstrap.mjs')),
    sdkPathPresent: Boolean(environment.COPILOT_SDK_PATH),
    parentMatches: Number.isSafeInteger(parentPid) && parentPid > 0 && String(parentPid) === environment.COPILOT_EXTENSION_PARENT_PID
  }
  for (const key of Object.keys(checks) as (keyof typeof checks)[]) probe?.check(key, checks[key])
  probe?.check('bootstrapEmbedded', argv.includes('extension_bootstrap.mjs'))
  probe?.check('extensionSandboxed', environment.COPILOT_EXTENSION_SANDBOXED === '1')
  if (!Object.values(checks).every(Boolean)) throw new LlmError(msg('error.copilot_runtime'), 'unavailable')
  return executable
}

// Keep normal OS/auth discovery; exclude code injection, provider overrides, host IPC, and tracing.
export function runtimeEnvironment(source = process.env): Record<string, string> {
  const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|XDG_CONFIG_HOME|XDG_CACHE_HOME|LANG|LC_ALL|GH_TOKEN|GITHUB_TOKEN|GH_HOST|GITHUB_HOST|GH_CONFIG_DIR|HTTPS_PROXY|HTTP_PROXY|ALL_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR)$/i
  return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, string] => allowed.test(entry[0]) && typeof entry[1] === 'string'))
}

async function desktopRuntime(probe?: DiscoveryProbe): Promise<{ sdk: DesktopSdk; path: string }> {
  let loadingSdk = false
  try {
    probe?.stage('runtime_identity')
    const executable = hostRuntime(undefined, undefined, undefined, undefined, probe)
    probe?.stage('runtime_path')
    const path = await realpath(executable)
    probe?.check('runtimePathResolved', true)
    loadingSdk = true
    probe?.stage('sdk_import')
    const name = '@github/copilot-sdk'
    const sdk: DesktopSdk = await import(name)
    probe?.check('sdkImported', true)
    probe?.stage('sdk_api')
    probe?.check('clientAvailable', typeof sdk.CopilotClient === 'function')
    probe?.check('stdioAvailable', typeof sdk.RuntimeConnection?.forStdio === 'function')
    if (typeof sdk.CopilotClient !== 'function' || typeof sdk.RuntimeConnection?.forStdio !== 'function') throw unavailable()
    return { sdk, path }
  } catch (error) {
    probe?.finish('failed', error)
    throw new LlmError(msg(loadingSdk ? 'error.copilot_sdk' : 'error.copilot_runtime'), 'unavailable')
  }
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

function reasoningMetadata(model: Model) {
  const supports = model.capabilities?.supports
  // Session RPC can return the raw Copilot API shape; client.listModels normalizes it.
  const normalized = supports?.reasoningEffort !== undefined || model.supportedReasoningEfforts !== undefined
  const choices = normalized ? model.supportedReasoningEfforts : supports?.reasoning_effort
  const configurable = normalized ? supports?.reasoningEffort === true : Array.isArray(choices)
  // Do not drop unknown entries and then misidentify a remaining level as the highest.
  const supportedReasoningEfforts = configurable && Array.isArray(choices) && choices.length <= 20 && choices.every(validReasoning)
    ? [...new Set<string>(choices)] : []
  return { supportedReasoningEfforts, ...(validReasoning(model.defaultReasoningEffort) && supportedReasoningEfforts.includes(model.defaultReasoningEffort)
    ? { defaultReasoningEffort: model.defaultReasoningEffort } : {}) }
}

function checkReasoning(model: Model, effort: string | undefined) {
  if (effort !== undefined && (!validReasoning(effort) || !reasoningMetadata(model).supportedReasoningEfforts.includes(effort))) {
    throw new LlmError(msg('error.copilot_reasoning'), 'invalid_params')
  }
}

// Dependency injection is used only by local fixture tests. Production always calls desktopRuntime.
export function createCopilotModels(parent: ModelSession, runtime = desktopRuntime, diagnostics?: Diagnostics, usageRecorder = createUsageRecorder) {
  const active = new Set<AbortController>()
  async function catalog(): Promise<Catalog> {
    const started = Date.now()
    const probe = diagnostics?.beginModelDiscovery()
    try {
      const timedOut = () => new LlmError(msg('error.copilot_catalog'), 'timeout')
      await withDeadline(runtime(probe), 15_000, timedOut)
      probe?.stage('session_api')
      probe?.check('modelListAvailable', typeof parent.rpc?.model?.list === 'function')
      if (typeof parent.rpc?.model?.list !== 'function') throw new LlmError(msg('error.copilot_catalog'), 'unavailable')
      probe?.stage('authentication')
      const auth = await withDeadline(parent.rpc.gitHubAuth.getStatus(), 15_000, timedOut)
      probe?.check('authenticated', auth.isAuthenticated === true)
      if (auth.isAuthenticated !== true) throw new LlmError(msg('error.copilot_sign_in'), 'unavailable')
      probe?.stage('model_list')
      const result = await withDeadline(parent.rpc.model.list({ refresh: true }), 15_000, timedOut)
      probe?.check('responseIsList', Array.isArray(result?.list))
      if (!Array.isArray(result?.list)) throw new LlmError(msg('error.copilot_catalog'), 'unavailable')
      probe?.stage('filter')
      const counts = { received: result.list.length, eligible: 0, invalid: 0, unattributed: 0, otherProvider: 0, policyBlocked: 0 }
      for (const item of result.list) {
        const model = item as Model | null
        if (!model || typeof model !== 'object' || typeof model.id !== 'string' || !model.id) counts.invalid++
        else if (!model.provider?.kind) counts.unattributed++
        else if (model.provider.kind !== 'copilot') counts.otherProvider++
        else if (model.policy && model.policy.state !== 'enabled') counts.policyBlocked++
        else counts.eligible++
      }
      for (const key of Object.keys(counts) as (keyof typeof counts)[]) probe?.count(key, counts[key])
      if (counts.eligible === 0) { probe?.finish('empty'); throw new LlmError(msg('error.copilot_no_models'), 'unavailable') }
      probe?.stage('complete')
      probe?.finish('ok')
      diagnostics?.record('copilot.catalog', 'ok', { ms: Date.now() - started })
      return { models: result.list.filter(eligible).map(model => ({ id: model.id, label: model.name || model.id, ...reasoningMetadata(model) })), source: 'GitHub Copilot', fetchedAt: Date.now() }
    } catch (error) {
      probe?.finish('failed', error)
      diagnostics?.record('copilot.catalog', 'failed', { ms: Date.now() - started, ...diagnosticError(error) })
      if (error instanceof LlmError && ['error.copilot_runtime', 'error.copilot_sdk', 'error.copilot_catalog', 'error.copilot_no_models', 'error.copilot_sign_in'].includes(error.text.code)) throw error
      throw new LlmError(msg('error.copilot_catalog'), 'unavailable')
    }
  }
  async function rewrite(input: CopilotRewrite, signal?: AbortSignal, ensureAccess?: () => Promise<void>): Promise<string> {
    if (signal?.aborted) throw cancelled()
    const controller = new AbortController()
    active.add(controller)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 180_000)
    let client: Client | undefined
    let directory: string | undefined
    let stop: Promise<boolean> | undefined
    let usage: UsageRecorder | undefined
    const sessionId = randomUUID()
    const stopClient = () => { if (client) stop ??= withDeadline(client.forceStop(), 10_000).then(() => true, () => false); return stop }
    controller.signal.addEventListener('abort', () => { void stopClient() }, { once: true })
    const check = () => { if (controller.signal.aborted) throw cancelled() }
    let phaseStarted = Date.now()
    let phase = 'copilot.runtime'
    const stage = (next: string) => { phase = next; phaseStarted = Date.now(); diagnostics?.record(phase, 'started') }
    stage(phase)
    try {
      const { sdk, path } = await runtime()
      check()
      if (input.reasoningEffort !== undefined) {
        stage('copilot.reasoning')
        const advertised = await withDeadline(parent.rpc.model.list({ refresh: true }), 15_000)
        const requested = advertised.list.filter(eligible).find(model => model.id === input.model)
        if (!requested) throw new LlmError(msg('error.copilot_model'), 'invalid_params')
        checkReasoning(requested, input.reasoningEffort)
        check()
      }
      directory = await mkdtemp(join(tmpdir(), 'enhance-copilot-'))
      const workspace = join(directory, 'workspace')
      await mkdir(workspace)
      check()
      client = new sdk.CopilotClient({ mode: 'empty', workingDirectory: workspace, baseDirectory: join(directory, 'home'),
        connection: sdk.RuntimeConnection.forStdio({ path, args: ['--no-auto-update'] }),
        env: runtimeEnvironment(), useLoggedInUser: true, logLevel: 'error', builtinPluginDirectories: [] })
      stage('copilot.start')
      await withDeadline(client.start(), 30_000)
      check()
      stage('copilot.usage')
      try { usage = await usageRecorder(sessionId) } catch { throw usageFailed() }
      check()
      stage('copilot.session')
      await ensureAccess?.()
      check()
      const session = await withDeadline(client.createSession({
        sessionId, onEvent: (event: unknown) => usage!.record(event),
        workingDirectory: workspace, configDirectory: join(directory, 'home'), model: input.model,
        ...(input.reasoningEffort !== undefined ? { reasoningEffort: input.reasoningEffort } : {}),
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
      if (session.sessionId !== sessionId) throw unavailable()
      stage('copilot.access')
      const [parentModels, helperModels, parentAuth, helperAuth, metadata] = await withDeadline(Promise.all([
        parent.rpc.model.list({ refresh: true }), session.rpc.model.list({ refresh: true }),
        parent.rpc.gitHubAuth.getStatus(), session.rpc.gitHubAuth.getStatus(), session.rpc.metadata.snapshot()
      ]), 20_000)
      if (!sameAccount(parentAuth, helperAuth)) throw new LlmError(msg('error.copilot_account'), 'unavailable')
      const model = helperModels.list.filter(eligible).find(model => model.id === input.model)
      const parentModel = parentModels.list.filter(eligible).find(model => model.id === input.model)
      if (!model || !parentModel) throw new LlmError(msg('error.copilot_model'), 'invalid_params')
      checkReasoning(parentModel, input.reasoningEffort)
      checkReasoning(model, input.reasoningEffort)
      stage('copilot.workspace')
      if (metadata.isRemote !== false || await realpath(metadata.workingDirectory) !== await realpath(workspace)) throw unavailable()
      stage('copilot.tools')
      await withDeadline(session.rpc.tools.initializeAndValidate(), 15_000)
      const [tools, selected] = await withDeadline(Promise.all([session.rpc.tools.getCurrentMetadata(), session.rpc.model.getCurrent()]), 15_000)
      if (!Array.isArray(tools.tools) || tools.tools.length !== 0 || selected.modelId !== input.model) throw unavailable()
      stage('copilot.reasoning')
      if (input.reasoningEffort !== undefined && selected.reasoningEffort !== input.reasoningEffort) {
        throw new LlmError(msg('error.copilot_reasoning_applied'), 'invalid_params')
      }
      diagnostics?.record(phase, 'ok', { ms: Date.now() - phaseStarted })
      const images = input.images ?? []
      stage('copilot.images')
      if (images.length && model.capabilities?.supports?.vision !== true) throw new LlmError(msg('error.copilot_images'), 'invalid_params')
      stage('copilot.account')
      const [currentParent, currentHelper] = await withDeadline(Promise.all([parent.rpc.gitHubAuth.getStatus(), session.rpc.gitHubAuth.getStatus()]), 10_000)
      if (!sameAccount(parentAuth, currentParent) || !sameAccount(parentAuth, currentHelper)) throw new LlmError(msg('error.copilot_account'), 'unavailable')
      await ensureAccess?.()
      check()
      stage('copilot.generate')
      const result = await session.sendAndWait({ prompt: input.user, attachments: images.map(image => ({ type: 'blob', data: image.base64, mimeType: image.type })) }, 180_000)
      check()
      if (typeof result?.data?.content !== 'string' || !result.data.content.trim()) throw new LlmError(msg('error.empty_answer'), 'action_failed')
      diagnostics?.record(phase, 'ok', { ms: Date.now() - phaseStarted })
      return result.data.content
    } catch (error) {
      diagnostics?.record(phase, controller.signal.aborted ? 'cancelled' : 'failed', { ms: Date.now() - phaseStarted, ...diagnosticError(error) })
      if (controller.signal.aborted) throw cancelled()
      // SDK exceptions can contain request text or credentials. Do not forward them to logs/UI/history.
      if (error instanceof LlmError) throw error
      throw unavailable()
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      stage('copilot.cleanup')
      const stopped = await stopClient()
      try {
        if (usage) {
          stage('copilot.usage')
          // forceStop can detach live listeners before the last durable receipt is delivered.
          // Reconcile only this stopped helper's journal, retaining it if accounting cannot be saved.
          try {
            if (stopped !== false && directory) await reconcileUsageJournal(join(directory, 'home', 'session-state', sessionId, 'events.jsonl'), usage)
            await usage.flush()
          }
          catch {
            diagnostics?.record(phase, 'failed', diagnosticError(usageFailed()))
            throw usageFailed()
          }
          diagnostics?.record(phase, 'ok', { ms: Date.now() - phaseStarted })
          stage('copilot.cleanup')
        }
        // Do not remove state while a helper might still be using it, or report success after a failed stop.
        if (stopped === false) { diagnostics?.record(phase, 'failed'); throw unavailable() }
        if (directory) {
          const inside = relative(tmpdir(), directory)
          if (inside && !isAbsolute(inside) && !inside.startsWith('..') && basename(directory).startsWith('enhance-copilot-')) {
            await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => { diagnostics?.record(phase, 'failed'); throw unavailable() })
          }
        }
        diagnostics?.record(phase, 'ok', { ms: Date.now() - phaseStarted })
      } finally {
        // Unknown shutdown leaves a conservative update blocker until this worker restarts.
        if (stopped !== false) active.delete(controller)
      }
    }
  }
  return { catalog, rewrite, hasActiveWork: () => active.size > 0, close() { for (const controller of active) controller.abort() } }
}

async function withDeadline<T>(promise: Promise<T>, ms: number, timeout = unavailable): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timeout()), ms) })]) }
  finally { clearTimeout(timer) }
}
