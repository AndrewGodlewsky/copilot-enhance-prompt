// setup.ts: starts the panel. the host's and the worker's events reach the panel's state (state.ts) and
// the first data is asked for. No UI here: the web panel (web/src/main.tsx) calls it once its frame
// is ready, and the tests call it on the host's panel runtime (src/panel/testing.ts), so the wiring that
// ships is the wiring that is tested.
import { on, plugin, read, settings } from '#panel'
import {
  applyProgress,
  cancel,
  cancelCatalogLoads,
  startCatalogLoads,
  learnTerminals,
  refreshConsents,
  refreshDataSummary,
  refreshDefaults,
  refreshModels,
  refreshRules,
  refreshTargets,
  stopTicking,
  workspaceRemoved
} from './actions.ts'
import { restoreSaved, tab } from './state.ts'
import { watchContextPreview, cancelContextPreview } from './context-preview.ts'

/**
 * Brings back what the last panel run saved, follows the events and loads the models, terminals,
 * rules and confirmations. Returns a function that stops following the events.
 */
export function wirePanel(): () => void {
  startCatalogLoads()
  restoreSaved()
  const stopPreview = watchContextPreview()
  const subscriptions = [
    settings.onDidChange(() => void refreshDefaults()),
    on('workspace.changed', () => void refreshTargets()),
    on('workspace.removed', ({ workspaceId, path }) => workspaceRemoved(workspaceId, path)),
    on('agent.status.changed', ({ terminalId, workspaceId }) => {
      // the host says which workspace this agent's terminal is in: keep it for telling workspaces apart.
      if (terminalId && workspaceId) learnTerminals([terminalId], workspaceId)
      void refreshTargets()
    }),
    plugin.on('enhance.progress', applyProgress)
  ]
  void refreshDefaults()
  void refreshModels()
  void refreshTargets()
  void refreshRules()
  void refreshConsents()
  // The stored-data counts read every saved key; load them only for the section that shows them.
  if (read(tab) === 'privacy') {
    void refreshDataSummary()
  }
  return () => {
    stopPreview()
    for (const subscription of subscriptions) subscription.dispose()
  }
}

/** The panel is closing or reloading: its run ends, and the request's signal stops the worker's model call too. */
export function closePanel(): void {
  cancelContextPreview()
  cancelCatalogLoads()
  cancel()
  stopTicking()
}
