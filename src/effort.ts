// Effort selects a rewriting model; it is independent of context and provider reasoning settings.
export const EFFORTS = ['low', 'medium', 'high'] as const
export type Effort = typeof EFFORTS[number]
export const EFFORT_LABELS: Record<Effort, string> = { low: 'Low', medium: 'Medium', high: 'High' }
export const EFFORT_SETTINGS = { low: 'effortLowModel', medium: 'effortMediumModel', high: 'effortHighModel' } as const
export const isEffort = (value: unknown): value is Effort => EFFORTS.some(effort => effort === value)
export const MODEL_SEP = '|'
export const PROFILE_DEFAULT = '__profile_default__'

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
