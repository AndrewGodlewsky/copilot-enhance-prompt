// Enhance Prompt's own worker contract. These operations are implemented by the session adapter.
import type { AppEvents, Disposable, JsonValue, KeyValueStore, RequestInput, RequestOptions, SettingsStore } from './runtime.ts'
import type { PluginPanelEvents, PluginRequests } from './protocol.ts'
export type { JsonValue } from './runtime.ts'
export type WorkspaceInfo = { id: string; name: string; project?: string | null; path: string; branch: string | null; hostId: string | null; kind?: string }
export type AgentInfo = { terminalId: string; title: string | null; agent: string | null; state: string; workspaceId?: string; stateStartedAt: number }
export type PlatformOperations = {
  'copilot.catalog': { input: {}; output: import('./catalog.ts').Catalog }
  'copilot.rewrite': { input: import('./copilot/models.ts').CopilotRewrite; output: { text: string } }
  'workspace.readContext': { input: {}; output: { displayName: string; branch: string; terminals: { id: string; title?: string }[]; workspaceId?: string } }
  'workspace.list': { input: {}; output: { workspaces: WorkspaceInfo[]; truncated?: boolean } }
  'agents.list': { input: {}; output: { agents: AgentInfo[] } }
  'terminal.read': { input: { terminalId: string; maxLines: number }; output: { lines: string[]; truncated: boolean } }
  'terminal.sendText': { input: { terminalId: string; text: string }; output: { accepted: boolean } }
  'session.send': { input: { sessionId: string; text: string; requestId?: string }; output: { accepted: boolean } }
  'editor.open': { input: { workspaceId: string; path: string }; output: { opened: true } }
}
export type ToolEvent = { terminalId: string; workspaceId: string | null; agent: string; tool: string; input: JsonValue; output?: JsonValue; timestamp?: number }
export type SaveEvent = { workspaceId: string | null; path: string; text?: string; content?: string }
export type WorkerHooks = { 'agent.tool.after': ToolEvent; 'editor.save.before': SaveEvent }
export type RequestContext = { signal: AbortSignal; panel: { id: string } }
export type EnhanceWorker = {
  /** Stable session identity supplied by the backend, never by panel input. */
  attachmentOwner: string
  storage: KeyValueStore
  settings: SettingsStore
  host: {
    has(name: string): boolean
    // Internal callback only: never accepted as panel JSON or exposed as an agent action.
    call<K extends keyof PlatformOperations>(name: K, input: PlatformOperations[K]['input'], options?: RequestOptions & { ensureAccess?: () => Promise<void> }): Promise<PlatformOperations[K]['output']>
  }
  panels: {
    handle<K extends keyof PluginRequests>(name: K, handler: (input: RequestInput<K>, ctx: RequestContext) => Promise<PluginRequests[K]['output']> | PluginRequests[K]['output']): Disposable
    post<K extends keyof PluginPanelEvents>(event: K, payload: PluginPanelEvents[K], options?: { panel?: string }): void
  }
  events: { on<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): Disposable }
  hooks: { on<K extends keyof WorkerHooks>(event: K, handler: (payload: WorkerHooks[K], next: (payload: WorkerHooks[K]) => unknown) => unknown): Disposable }
  commands: { register(name: string, handler: () => unknown): Disposable }
  diagnostics?: Pick<import('./diagnostics.ts').Diagnostics, 'record'>
  log(message: string): void
}
