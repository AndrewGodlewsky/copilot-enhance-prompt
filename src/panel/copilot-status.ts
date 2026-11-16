import { read } from '#panel'
import { RECOMMENDED, resolveEffort, resolveEffortModel, resolveReasoning, type Effort } from '../effort.ts'
import { diagnosticError } from '../diagnostics.ts'
import { isMessage, type Message } from '../messages.ts'
import { catalogs, catalogLoading, copilotCheck, copilotRunFailure, effectiveEffort, effortModels, effortReasoning, enabledProfiles, privacy, message, say } from './state.ts'

export function effortConfiguration() {
  const effort = read(effectiveEffort)
  return JSON.stringify([effort, read(effortModels)[effort], read(effortReasoning)[effort], read(enabledProfiles)])
}

export function connectionFailure(text: Message | null): Message | null {
  if (!text) return null
  if (text.code.startsWith('error.copilot_') || text.code === 'error.effort_model') return text
  if (text.code === 'error.all_failed' && Array.isArray(text.params?.list)) {
    for (const attempt of text.params.list) {
      if (!isMessage(attempt) || attempt.code !== 'error.attempt') continue
      const reason = attempt.params?.reason
      if (isMessage(reason) && reason.code.startsWith('error.copilot_')) return reason
    }
  }
  return null
}

export function reasoningOptions(effort: Effort) {
  const assignment = read(effortModels)[effort]
  const saved = read(effortReasoning)[effort]
  const options = [{ value: 'default', label: assignment === 'recommended' ? `Recommended (${RECOMMENDED[effort].reasoning})` : 'Model default' }]
  try {
    const catalog = read(catalogs).copilot
    const profile = resolveEffortModel(effort, assignment, read(enabledProfiles), catalog)
    const model = catalog?.models.find(model => model.id === profile.model)
    for (const value of model?.supportedReasoningEfforts ?? []) options.push({ value, label: value[0].toUpperCase() + value.slice(1) })
    if (model && saved === 'highest' && !options.some(option => option.value === saved)) {
      options.push({ value: saved, label: `Highest supported (${resolveReasoning(model, saved)})` })
    }
  } catch { /* Keep the saved choice visible; connection status explains the failure. */ }
  if (!options.some(option => option.value === saved)) options.push({ value: saved, label: `${saved} (unavailable)` })
  return options
}

export function effortProblem(effort: Effort): string | null {
  const catalog = read(catalogs).copilot
  if (!catalog || catalog.error || read(catalogLoading).copilot) return null
  try {
    resolveEffort(effort, read(effortModels)[effort], read(effortReasoning)[effort], read(enabledProfiles), catalog)
    return null
  } catch (error) { return message(error) }
}

function readinessStatus(): { kind: 'checking' | 'ready' | 'error'; title: string; detail: string; code?: string } {
  if (read(privacy).allowOnlineModelLists === false) return { kind: 'error', title: 'Copilot model access is off', detail: 'Enable Fetch model lists online in Settings to use Copilot models, then select Retry.', code: 'error.lists_off' }
  const catalog = read(catalogs).copilot
  if (read(catalogLoading).copilot) return { kind: 'checking', title: 'Checking Copilot…', detail: 'Checking your account and available models. No prompt is submitted.' }
  if (!catalog) return { kind: 'error', title: 'Copilot has not been checked', detail: 'Select Retry to check your account and available models.' }
  if (catalog.error) return { kind: 'error', title: 'Copilot needs attention', detail: catalog.error, code: diagnosticError({ text: catalog.errorText }).code }
  try {
    const effort = read(effectiveEffort)
    resolveEffort(effort, read(effortModels)[effort], read(effortReasoning)[effort], read(enabledProfiles), catalog)
  } catch (error) {
    return { kind: 'error', title: 'Effort configuration needs attention', detail: message(error), code: diagnosticError(error).code }
  }
  const failure = read(copilotRunFailure)
  if (failure?.configuration === effortConfiguration()) return { kind: 'error', title: 'The last background attempt failed', detail: `${say(failure.text)} Check connection checks the account and model list only; select Enhance to try the background model again.`, code: failure.text.code }
  return { kind: 'ready', title: 'Copilot account connected', detail: 'Model and reasoning are available. Background access is verified when you select Enhance.' }
}

export function copilotStatus() {
  const status = readinessStatus()
  const catalog = read(catalogs).copilot
  const check = read(copilotCheck)
  const actionLabel = status.kind === 'checking' ? 'Checking…'
    : !catalog || catalog.error || status.code === 'error.lists_off' ? 'Retry connection'
    : status.code === 'error.effort_model' || status.code === 'error.copilot_recommended' || status.code === 'error.copilot_reasoning' ? 'Refresh models'
    : 'Check connection'
  const checkedAt = check?.completedAt ? new Date(check.completedAt).toLocaleTimeString('en-US') : ''
  const feedback = !check ? '' : check.outcome === 'checking' ? `Connection check ${check.attempt} is running.`
    : check.outcome === 'ok' ? `Check ${check.attempt} completed at ${checkedAt}: account and model list refreshed.`
    : `Check ${check.attempt} failed at ${checkedAt}. See the message above or open Show Logs.`
  return { ...status, actionLabel, feedback }
}
