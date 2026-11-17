// Copilot model profiles in storage and their fallback chain.
import type { EnhanceWorker } from '#host'
import { isTransient, LlmError, messageOf } from './llm.ts'
import { english, msg, type Message } from './messages.ts'
import type { ImageData } from './images.ts'
import { MODELS_KEY, modelsToJson, parseModelsConfig, type ModelProfile, type ModelsConfig, type ProfileView } from './presets.ts'

export async function loadModels(host: EnhanceWorker): Promise<ModelsConfig> {
  return parseModelsConfig(await host.storage.get(MODELS_KEY))
}

export async function saveModels(host: EnhanceWorker, config: ModelsConfig): Promise<void> {
  await host.storage.set(MODELS_KEY, modelsToJson(config))
}

export function effectiveModel(profile: ModelProfile): string { return profile.model }

export function viewProfiles(profiles: ModelProfile[]): ProfileView[] {
  return profiles.map(profile => ({ ...profile, effectiveModel: effectiveModel(profile) }))
}

/** `error` is English (logs, history); `errorText` the same as a Message for the panel. */
export type Attempt = { profileId: string; name: string; model: string; reasoningEffort?: string; ok: boolean; error?: string; errorText?: Message; ms: number }

export type ChainOptions = {
  /** Revalidate prepared context before every dispatch, including fallback attempts. */
  ensureAccess?: () => Promise<void>
  /** Applies to the first candidate only; fallback profiles retain their model defaults. */
  reasoningEffort?: string
  /** The person's cancel. */
  signal?: AbortSignal
  /** Per-model timeout. */
  timeoutMs: number
  /** Whole chain budget; defaults to unlimited. */
  totalMs?: number
  fallback: boolean
  fallbackOn: 'any' | 'transient'
  /** Progress: called before each model is tried (1-based `attempt` of `total`). */
  onAttempt?: (profile: ModelProfile, model: string, attempt: number, total: number) => void
  /** Pictures attached to the prompt, validated by the Copilot model adapter. */
  images?: readonly ImageData[]
}

export class ChainError extends Error {
  code: string
  attempts: Attempt[]
  /** The message as a code and parameters, for structured error handling. */
  text: Message
  constructor(text: Message, code: string, attempts: Attempt[]) {
    super(english(text))
    this.text = text
    this.code = code
    this.attempts = attempts
  }
}

/**
 * Orders the candidates: a chosen profile first, then (with fallback) the other enabled
 * profiles in their saved order.
 */
export function candidates(profiles: ModelProfile[], preferredId: string | null, fallback: boolean): ModelProfile[] {
  const supported = profiles.filter(profile => profile.provider === 'copilot' && profile.preset === 'copilot')
  const enabled = supported.filter((profile) => profile.enabled)
  const preferred = preferredId ? profiles.find((profile) => profile.id === preferredId) : undefined
  if (preferredId && (!preferred || preferred.provider !== 'copilot' || preferred.preset !== 'copilot')) return []
  const ordered = preferred ? [preferred, ...enabled.filter((p) => p.id !== preferred.id)] : enabled
  return fallback ? ordered : ordered.slice(0, 1)
}

export async function runChain(
  host: EnhanceWorker,
  list: ModelProfile[],
  system: string,
  user: string,
  options: ChainOptions
): Promise<{ text: string; profile: ModelProfile; attempts: Attempt[] }> {
  const attempts: Attempt[] = []
  if (list.length === 0) {
    throw new ChainError(msg('error.no_model'), 'invalid_params', attempts)
  }
  const started = Date.now()
  if (list.some(profile => profile.provider !== 'copilot' || profile.preset !== 'copilot')) {
    throw new ChainError(msg('error.invalid_profile'), 'invalid_params', attempts)
  }
  let lastError: unknown = null
  for (const profile of list) {
    if (options.signal?.aborted) {
      break
    }
    const remaining = options.totalMs === undefined ? options.timeoutMs : options.totalMs - (Date.now() - started)
    if (remaining <= 50) {
      break
    }
    const attemptStart = Date.now()
    const model = effectiveModel(profile)
    const reasoningEffort = attempts.length === 0 ? options.reasoningEffort : undefined
    options.onAttempt?.(profile, model, attempts.length + 1, list.length)
    const controller = new AbortController()
    // The per-model timeout keeps time for the model that comes next. The last one to try has no
    // next: within a run's own limit it may use all that is left, since stopping a slow answer
    // early would only turn it into an error.
    const last = profile === list[list.length - 1]
    const limit = last && options.totalMs !== undefined ? remaining : Math.min(options.timeoutMs, remaining)
    let ranOut = false
    const timer = setTimeout(() => {
      ranOut = true
      controller.abort()
    }, limit)
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort)
    try {
      if ((await host.settings.get('allowOnlineModelLists')) === false) {
        throw new LlmError(msg('error.lists_off'), 'unavailable')
      }
      await options.ensureAccess?.()
      options.signal?.throwIfAborted()
      const { text } = await host.host.call('copilot.rewrite', { model, ...(reasoningEffort ? { reasoningEffort } : {}), system, user, images: (options.images ?? []).map(image => ({ type: image.type, base64: image.base64 })) }, { signal: controller.signal, ensureAccess: options.ensureAccess })
      await options.ensureAccess?.()
      attempts.push({ profileId: profile.id, name: profile.name, model, ...(reasoningEffort ? { reasoningEffort } : {}), ok: true, ms: Date.now() - attemptStart })
      return { text, profile, attempts }
    } catch (caught) {
      const accountingFailed = messageOf(caught).code === 'error.copilot_usage'
      // Stopped by the limit above, not by the person: say which model, and how long it had.
      const error =
        ranOut && !options.signal?.aborted && !accountingFailed ? new LlmError(msg('error.model_timeout', { model: model || profile.name, seconds: Math.max(1, Math.round(limit / 1000)) }), 'timeout') : caught
      lastError = error
      attempts.push({
        profileId: profile.id,
        name: profile.name,
        model,
        ...(reasoningEffort ? { reasoningEffort } : {}),
        ok: false,
        error: (error as Error).message,
        errorText: messageOf(error),
        ms: Date.now() - attemptStart
      })
      // A charged request may already have completed. Keep the recording failure visible.
      if (messageOf(error).code === 'error.research_privacy_changed') throw new ChainError(messageOf(error), 'cancelled', attempts)
      if (accountingFailed || ['error.copilot_reasoning', 'error.copilot_reasoning_applied'].includes(messageOf(error).code)) throw new ChainError(messageOf(error), 'action_failed', attempts)
      if (options.signal?.aborted) {
        break
      }
      if (options.fallbackOn === 'transient' && !isTransient(error)) {
        break
      }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }
  if (options.signal?.aborted) {
    throw new ChainError(msg('error.cancelled'), 'cancelled', attempts)
  }
  const tried: Message[] = attempts.map((a) => msg('error.attempt', { name: a.name, reason: a.errorText ?? a.error ?? 'skipped' }))
  const code = lastError instanceof LlmError ? lastError.code : 'action_failed'
  let text: Message = msg('error.out_of_time')
  if (attempts.length > 1) text = msg('error.all_failed', { list: tried })
  else if (lastError) text = messageOf(lastError)
  throw new ChainError(text, code, attempts)
}
