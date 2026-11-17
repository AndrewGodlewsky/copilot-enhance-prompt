import { DEFAULTS } from './defaults.ts'
import { MAX_FILES } from './image-limits.ts'

export const REQUEST_BYTES = 2_500_000
export const MAX_WORK = 32
export const MAX_UPLOADS = 8
export const MAX_REWRITES = 4
export const MAX_PROFILES = 50
export const invalidInput = (message = 'Invalid canvas request.') => Object.assign(new Error(message), { code: 'invalid_params', status: 400 })
export const busyError = () => Object.assign(new Error('Too much work is pending. Finish pending work and retry.'), { code: 'rate_limited', status: 429 })
const ranges: Record<string, readonly [number, number]> = {
  historyLimit: [0, 500], timeoutSeconds: [5, 300], terminalLines: [1, 1000], otherAgentsMax: [1, 8], otherAgentsLines: [10, 300]
}

export function validSetting(key: string, value: unknown): boolean {
  if (typeof key !== 'string') return false
  if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) return false
  if (typeof value === 'number') {
    const range = ranges[key]
    return !!range && Number.isSafeInteger(value) && value >= range[0] && value <= range[1]
  }
  return typeof value !== 'string' || value.length <= 64_000
}

export function effectiveSetting(key: string, value: unknown) {
  const range = ranges[key]
  if (range && typeof value === 'number' && Number.isFinite(value)) return Math.min(range[1], Math.max(range[0], Math.round(value)))
  return validSetting(key, value) ? value : DEFAULTS[key]
}

/** Validate without serializing or recursively walking untrusted values. Unknown fields remain inert. */
export function validateJson(input: unknown): void {
  const todo: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }]
  let nodes = 0, chars = 0
  while (todo.length) {
    const { value, depth } = todo.pop()!
    if (++nodes > 20_000 || depth > 24 || chars > REQUEST_BYTES) throw invalidInput('Request complexity exceeds the limit.')
    if (typeof value === 'string') { chars += value.length; if (chars > REQUEST_BYTES) throw invalidInput('Request text exceeds the limit.') }
    else if (typeof value === 'number') { if (!Number.isFinite(value)) throw invalidInput() }
    else if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length > 1024) throw invalidInput('Request list exceeds the limit.')
      for (const key of keys) { chars += key.length; todo.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 }) }
    } else if (value !== null && typeof value !== 'boolean' && value !== undefined) throw invalidInput()
  }
}

export function validateRequest(name: string, input: any): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput()
  validateJson(input)
  const text = (key: string, max: number, required = false) => {
    if (input[key] === undefined && !required) return
    if (typeof input[key] !== 'string' || input[key].length > max) throw invalidInput(`Invalid ${key}; maximum length is ${max} characters.`)
  }
  const list = (key: string, max: number) => {
    if (input[key] === undefined) return
    if (!Array.isArray(input[key]) || input[key].length > max || input[key].some((value: unknown) => typeof value !== 'string' || value.length > 32_768)) throw invalidInput(`${key} exceeds the limit of ${max} paths.`)
  }
  if (name === 'prompt.enhance' || name === 'context.preview') {
    text('prompt', 1_000_000, input.resume !== true)
    list('files', MAX_FILES); list('exclude', 1024)
    for (const key of ['style', 'level', 'effort', 'runId', 'structureId']) text(key, 64)
    for (const key of ['workspaceId', 'terminalId', 'profileId', 'model']) if (input[key] !== null) text(key, 32_768)
  }
  if (name === 'prompt.send' || name === 'prompt.copy') text('text', 1_000_000, true)
  if (name === 'models.move' && input.to !== undefined && (!Number.isSafeInteger(input.to) || input.to < 0 || input.to >= MAX_PROFILES)) throw invalidInput()
  if (name === 'rules.save') {
    const config = input.config
    if (!config || !Array.isArray(config.rules) || !Array.isArray(config.structures) || config.rules.length > 1000 || config.structures.length > 20 || config.structures.some((item: any) => !Array.isArray(item?.sections) || item.sections.length > 12)) throw invalidInput('Rules or structures exceed the limit.')
  }
}
