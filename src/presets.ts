// The installed GitHub Copilot runtime owns authentication and model execution.
import type { Message } from './messages.ts'
import type { JsonValue } from '#panel'

export type ModelProfile = {
  id: string
  name: string
  preset: 'copilot'
  provider: 'copilot'
  model: string
  enabled: boolean
}

export type ModelsConfig = {
  /** In fallback order: the first enabled profile is tried first. */
  profiles: ModelProfile[]
  /** Profile that picks relevant files at Max; missing saved profiles stay explicit until replaced. */
  selectorProfileId: string | null
}

export type ProfileView = ModelProfile & { effectiveModel: string }
export const MODELS_KEY = 'models'
const str = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback

/** Persisted or untrusted external profiles are discarded, never converted to Copilot. */
export function normalizeProfile(value: unknown): ModelProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const id = str(raw.id)
  if (!/^[a-z0-9-]{1,40}$/.test(id) || raw.preset !== 'copilot' || raw.provider !== 'copilot') return null
  return {
    id,
    name: str(raw.name).trim().slice(0, 60) || 'GitHub Copilot',
    preset: 'copilot',
    provider: 'copilot',
    model: str(raw.model).trim().slice(0, 200),
    enabled: raw.enabled !== false
  }
}

export function parseModelsConfig(value: JsonValue | null): ModelsConfig {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const profiles: ModelProfile[] = []
  for (const item of Array.isArray(raw.profiles) ? raw.profiles : []) {
    const profile = normalizeProfile(item)
    if (profile && !profiles.some(existing => existing.id === profile.id)) profiles.push(profile)
  }
  const id = raw.selectorProfileId
  return { profiles, selectorProfileId: typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id) ? id : null }
}

export function modelsToJson(config: ModelsConfig): JsonValue {
  return { profiles: config.profiles.map(profile => ({ ...profile })), selectorProfileId: config.selectorProfileId }
}

export function newProfileId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'model'
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`
}

export const CONTEXT_LEVELS = ['off', 'basic', 'standard', 'deep', 'max', 'ai-test'] as const
export type ContextLevel = (typeof CONTEXT_LEVELS)[number]
export const CONTEXT_LEVEL_LABELS: Record<ContextLevel, string> = {
  off: 'Off',
  basic: 'Basic (saved): project identity only',
  standard: 'Project overview',
  deep: 'Relevant code',
  max: 'AI-assisted',
  'ai-test': 'AI Test'
}
export const CONTEXT_LEVEL_HINTS: Record<ContextLevel, string> = {
  off: 'No automatic project context. Your instructions and explicit attachments still apply.',
  basic: 'Keeps your saved Basic selection: project and Copilot identity, without reading project files.',
  standard: 'Quick project orientation: instructions, README, stack, commands, and a file overview. No extra model call.',
  deep: 'Best for coding tasks: project overview plus relevant code and Git changes. No extra model call.',
  max: 'Lets a model help choose up to 10 relevant files. Adds a model request and may take longer. Preview shows local matches; AI choices appear after enhancement.',
  'ai-test': 'Experimental: the effort model reads project excerpts and can request more evidence before rewriting. Up to two extra model calls and 45 seconds of research; usage charges may apply. Preview shows initial context only.'
}
export function isContextLevel(value: unknown): value is ContextLevel {
  return typeof value === 'string' && (CONTEXT_LEVELS as readonly string[]).includes(value)
}

/** One piece of context the rewriter saw; `id` is stable so the person can exclude it. */
/**
 * A context item as the panel lists it. `label` and `note` are English (the model reads them);
 * `title` and `why` carry structured messages for the panel and diagnostics.
 */
export type ContextItemView = { id: string; kind: string; label: string; chars: number; note?: string; title?: Message; why?: Message }
