// The panel <-> worker contract, declared once: the panel (src/panel/, web/src) and src/worker.ts both read it.
import type { Message } from './messages.ts'
import type { RulesConfig } from './rules.ts'
import type { ContextItemView, ProfileView } from './presets.ts'

/** The longest a panel may wait for its worker (the host caps `timeoutMs` at 120000). */
export const PANEL_REQUEST_LIMIT_MS = 120_000

export type AttemptView = { profileId: string; name: string; model: string; reasoningEffort?: string; ok: boolean; error?: string; errorText?: Message; ms: number }
export type ProfileInput = {
  id?: string
  name: string
  preset?: 'copilot'
  provider?: 'copilot'
  model: string
  enabled: boolean
}
export type ModelsView = { profiles: ProfileView[]; selectorProfileId: string | null }

  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
export interface PluginRequests {
    /** Bounded, in-memory diagnostics with no request/response content or account identifiers. */
    'logs.get': { output: import('./diagnostics.ts').WorkerDiagnostics }
    /** Rewrites `prompt` with the model chain (or one profile), with context at `level`. */
    'prompt.enhance': {
      input: {
        prompt: string
        style?: string
        terminalId?: string | null
        level?: string
        /** Settings choose the rewriting model and reasoning for this effort; direct model fields are ignored. */
        effort?: string
        profileId?: string | null
        /** A model of that profile for this prompt only (from its live list). */
        model?: string
        exclude?: string[]
        /** Set by the panel to receive `enhance.progress` for this run. */
        runId?: string
        /** A prompt structure (Rules tab) whose sections replace the style's shape. */
        structureId?: string
        /** the host's id of the workspace the panel is in (several can share a name and branch). */
        workspaceId?: string
        /** Attached files of any kind, by the paths attachments.put answered (the worker reads no other path). */
        files?: string[]
        /**
         * The panel keeps waiting (needs `runId`): the host ends a request after 120 s, so a run that
         * takes longer answers `pending`, and the panel asks again with `resume`, as often as it takes.
         */
        resumable?: boolean
        /** Asks again for the run `runId` that answered `pending`; nothing else of the input is read. */
        resume?: boolean
      }
      output: {
        /** The run is still going: ask again with `resume`. Every other field is empty then. */
        pending?: boolean
        enhanced: string
        model: string
        profileName: string
        ms: number
        attempts: AttemptView[]
        context: ContextItemView[]
        notes: Message[]
      }
    }
    /** What context would be sent, without calling a model (no AI file picking). */
    'context.preview': {
      input: { prompt: string; terminalId?: string | null; level?: string; exclude?: string[]; workspaceId?: string }
      output: { context: ContextItemView[]; notes: Message[]; chars: number }
    }
    /** Types `text` into an agent terminal. */
    'prompt.send': {
      /** `force`: the person was told the agent is waiting for an answer from them and sends anyway (Enter is never pressed then). */
      input: { terminalId: string; text: string; enter?: boolean; force?: boolean }
      output: { accepted: boolean }
    }
    /** Copies `text` to the OS clipboard of host. */
    'prompt.copy': { input: { text: string }; output: { copied: boolean; error?: string } }
    /** One chunk (base64, in order) of a file pasted, dropped or picked in the web panel; the last answers with its path. */
    'attachments.put': { input: { id: string; name: string; index: number; total: number; data: string; size?: number }; output: { path: string; bytes: number } | { received: number } }
    /** The latest progress of a run (what `enhance.progress` last posted), for a caller that cannot hear panel events. */
    'enhance.progress.get': { input: { runId: string }; output: PluginPanelEvents['enhance.progress'] | null }
    /** Which Privacy switches the person confirmed in the panel, and which need a confirmation. */
    'consents.get': { output: { granted: string[]; needed: string[] } }
    /** The person confirmed (or withdrew) a switch that needs it, after reading what it allows. */
    'consent.set': { input: { key: string; granted: boolean }; output: { granted: string[] } }
    /** Opens a file of the focused workspace (a path relative to it) in the host's editor. */
    'editor.open': { input: { path: string; workspaceId?: string }; output: { opened: true } }
    /** Agent terminals of the focused workspace, agents first. */
    'targets.list': {
      /** `known`: the workspace id of terminals the panel has seen (the host's agent events, or the person's pick). */
      input: { known?: Record<string, string> }
      /** `choices`: the folders the focused workspace could be when several share its name and branch
       *  (`project`: its repository's name, where the host gives one). */
      /** `workspace`: the focused workspace's name. `project`: the name its project's rules are kept
       *  under (the repository's name in the host), null while it is not known which project this is. */
      /** `workspaceId`: the host's id of the focused workspace (null when it cannot tell): the panel keeps each
       *  project's draft and result apart by it. `workspacePath`: its folder. */
      output: {
        /** `title` and `state` (an agent's: working, blocked, waiting, done) are what `label` is made of. */
        targets: { terminalId: string; label: string; agent: string | null; title?: string; state?: string }[]
        workspace?: string | null
        project?: string | null
        workspaceId?: string | null
        workspacePath?: string
        choices?: { id: string; path: string; project?: string }[]
      }
    }
    'models.get': { output: ModelsView }
    /** Adds or updates a Copilot profile. */
    'models.save': { input: ProfileInput; output: ModelsView }
    'models.delete': { input: { id: string }; output: ModelsView }
    /** Moves a profile one step, or straight to position `to` (0 = tried first). */
    'models.move': { input: { id: string; direction?: 'up' | 'down'; to?: number }; output: ModelsView }
    'models.roles': { input: { selectorProfileId: string | null }; output: ModelsView }
    /** Sends a tiny request through one profile. */
    'models.test': { input: { id: string }; output: { ok: boolean; message: string; text?: Message; ms: number } }
    /** Models available through the attached Copilot account and policy. */
    'models.catalog': {
      input: { preset?: 'copilot'; profileId?: string; refresh?: boolean }
      output: {
        models: import('./catalog.ts').Catalog['models']
        source: string
        fetchedAt: number
        error?: string
        /** The same reason as a message, when it is the plugin's own (a switch that is off). */
        errorText?: Message
      }
    }
    /** Deletes one history entry (in order with new entries being saved). */
    'history.remove': { input: { id: string }; output: { ok: true } }
    /** Deletes the whole history (in order with new entries being saved). */
    'history.clear': { output: { ok: true } }
    /** Undo of history.remove: brings back the entry of that id, if this worker removed it a moment ago. */
    'history.restore': { input: { id: string }; output: { restored: boolean } }
    /** Rules tab: your rules and prompt structures. */
    'rules.get': { output: RulesConfig }
    /** Replaces them (cleaned and capped); answers with what was saved. */
    'rules.save': { input: { config: RulesConfig }; output: RulesConfig }
    /** What the plugin keeps: history entries, saved models and cached model lists. */
    'data.summary': { output: { history: number; profiles: number; catalogs: number } }
    'usage.status': { output: import('./copilot/usage-recovery.ts').UsageRecoveryStatus }
    'usage.recover': { output: import('./copilot/usage-recovery.ts').UsageRecoveryStatus }
    /** Deletes history, cached model lists, or everything (models too). */
    'data.clear': { input: { what: 'history' | 'catalogs' | 'all' }; output: { ok: true } }

  }
  // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
export interface PluginPanelEvents {
    /** The steps of the panel's enhance run, a full snapshot on every change. */
    'enhance.progress': {
      runId: string
      startedAt: number
      steps: { key: string; status: 'pending' | 'running' | 'done' | 'skipped' | 'failed'; detail?: string }[]
    }
  }
