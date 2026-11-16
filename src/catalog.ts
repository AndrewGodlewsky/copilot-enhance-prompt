// Model metadata supplied by the installed GitHub Copilot runtime.
import type { Message } from './messages.ts'
export type Catalog = {
  models: { id: string; label: string; description?: string; isDefault?: boolean; supportedReasoningEfforts?: string[]; defaultReasoningEffort?: string }[]
  source: string
  fetchedAt: number
  error?: string
  errorText?: Message
}
