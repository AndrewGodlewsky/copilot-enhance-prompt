// Each effort selects a Copilot model and its reasoning; context remains independent.
import type { Catalog } from './catalog.ts'
import type { ModelProfile } from './presets.ts'
import { LlmError } from './llm.ts'
import { msg } from './messages.ts'
export const EFFORTS = ['low', 'medium', 'high'] as const
export type Effort = typeof EFFORTS[number]
export const EFFORT_LABELS: Record<Effort, string> = { low: 'Low', medium: 'Medium', high: 'High' }
export const EFFORT_SETTINGS = { low: 'effortLowModel', medium: 'effortMediumModel', high: 'effortHighModel' } as const
export const REASONING_SETTINGS = { low: 'effortLowReasoning', medium: 'effortMediumReasoning', high: 'effortHighReasoning' } as const
export const RECOMMENDED = {
  low: { name: 'Claude Haiku 5.5', aliases: ['claudehaiku55', 'haiku55'], reasoning: 'highest' },
  medium: { name: 'GPT-6.1 Terra', aliases: ['gpt61terra'], reasoning: 'high' },
  high: { name: 'Claude Sonnet 5.5', aliases: ['claudesonnet55', 'sonnet55'], reasoning: 'medium' }
} as const
export const validReasoning = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(value)
const REASONING_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max']

export function resolveReasoning(model: Catalog['models'][number], choice: string): string | undefined {
  if (choice === 'default') return undefined
  const supported = model.supportedReasoningEfforts ?? []
  if (validReasoning(choice) && supported.includes(choice)) return choice
  if (choice === 'highest' && supported.length && supported.every(value => REASONING_ORDER.includes(value))) {
    return REASONING_ORDER.filter(value => supported.includes(value)).at(-1)!
  }
  throw new LlmError(msg('error.copilot_reasoning'), 'invalid_params')
}

export function resolveEffortModel(effort: Effort, assignment: string, profiles: ModelProfile[], catalog?: Catalog): ModelProfile {
  const fail = () => new LlmError(msg('error.effort_model', { effort: EFFORT_LABELS[effort] }), 'invalid_params')
  const enabled = profiles.filter(profile => profile.enabled && profile.provider === 'copilot' && profile.preset === 'copilot')
  const direct = parseCatalogAssignment(assignment)
  let profile: ModelProfile
  if (direct) {
    if (!catalog || catalog.error || !catalog.models.some(model => model.id === direct)) throw fail()
    profile = { id: 'copilot-catalog', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: direct, enabled: true }
  } else if (assignment === 'recommended') {
    const preset = RECOMMENDED[effort]
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
    const matches = catalog?.models.filter(model => preset.aliases.some(alias => alias === normalize(model.id) || alias === normalize(model.label))) ?? []
    if (matches.length === 0) throw new LlmError(msg('error.copilot_recommended_missing', { model: preset.name }), 'invalid_params')
    if (matches.length !== 1) throw new LlmError(msg('error.copilot_recommended', { model: preset.name }), 'invalid_params')
    profile = { id: 'copilot-recommended', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: matches[0].id, enabled: true }
  } else {
    const parsed = parseModelAssignment(assignment)
    const selected = parsed?.profileId ? enabled.find(profile => profile.id === parsed.profileId) : parsed ? enabled[0] : undefined
    if (!selected) throw fail()
    profile = { ...selected, model: parsed!.model || selected.model }
  }
  const model = catalog?.models.find(model => model.id === profile.model)
  if (catalog && !model) throw fail()
  return profile
}

export function resolveEffort(effort: Effort, assignment: string, reasoning: string, profiles: ModelProfile[], catalog?: Catalog): { profile: ModelProfile; reasoningEffort?: string } {
  const profile = resolveEffortModel(effort, assignment, profiles, catalog)
  const model = catalog?.models.find(model => model.id === profile.model)
  if (assignment === 'recommended' && reasoning === 'default') reasoning = RECOMMENDED[effort].reasoning
  return { profile, reasoningEffort: resolveReasoning(model ?? { id: profile.model, label: profile.model }, reasoning) }
}
export const isEffort = (value: unknown): value is Effort => EFFORTS.some(effort => effort === value)
export const MODEL_SEP = '|'
export const PROFILE_DEFAULT = '__profile_default__'

/** No pipe: a legacy profile id starting with "catalog:" remains a profile assignment. */
export function parseCatalogAssignment(value: unknown): string | null {
  return typeof value === 'string' ? /^catalog:([^\s|\x00-\x1f\x7f]{1,200})$/u.exec(value)?.[1] ?? null : null
}

export const catalogAssignment = (model: string) => `catalog:${model}`

export function modelAssignment(profileId: string, model: string): string {
  return `${profileId}${MODEL_SEP}${model || PROFILE_DEFAULT}`
}

export function parseModelAssignment(value: unknown): { profileId: string | null; model: string } | null {
  if (value === 'auto') return { profileId: null, model: '' }
  if (typeof value !== 'string' || value.length > 500) return null
  const parts = value.split(MODEL_SEP)
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts.some(part => part !== part.trim() || /[\r\n\x00]/.test(part))) return null
  return { profileId: parts[0], model: parts[1] === PROFILE_DEFAULT ? '' : parts[1] }
}
