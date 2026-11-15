// Structured model errors shared by the Copilot adapter and worker.
import { english, raw, type Message } from './messages.ts'

export class LlmError extends Error {
  code: string
  /** HTTP status when the endpoint answered with an error. */
  status?: number
  /** The message as a code and parameters, for structured error handling. */
  text: Message
  constructor(message: Message | string, code = 'action_failed', status?: number) {
    const text = typeof message === 'string' ? raw(message) : message
    super(english(text))
    this.text = text
    this.code = code
    this.status = status
  }
}

/** An error's message as a Message: its own when it has one, else its text as is. */
export function messageOf(error: unknown): Message {
  if (error && typeof error === 'object' && 'text' in error && (error as { text: unknown }).text) {
    const text = (error as { text: Message }).text
    if (typeof text === 'object' && typeof text.code === 'string') return text
  }
  return raw(error instanceof Error ? error.message : String(error))
}

/** Errors worth retrying on another model: network, timeout, rate limit, server side. */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof LlmError)) {
    return false
  }
  if (error.code === 'timeout' || error.code === 'unavailable' || error.code === 'rate_limited') {
    return true
  }
  return error.status !== undefined && (error.status >= 500 || error.status === 408)
}
