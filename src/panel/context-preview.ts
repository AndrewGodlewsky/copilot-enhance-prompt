import { plugin, read, set, subscribe } from '#panel'
import type { ContextItemView } from '../presets.ts'
import type { Message } from '../messages.ts'
import { busy, contextError, contextFor, contextLoading, contextNotes, contextPreferences, contextShown, draft, effectiveLevel, excluded, message, optionsOpen, put, target, workspaceKey } from './state.ts'

export function knownWorkspaceId(): Record<string, string> {
  const key = read(workspaceKey)
  return key && !key.startsWith('name:') ? { workspaceId: key } : {}
}

export const contextKey = () => JSON.stringify([read(draft), read(effectiveLevel), read(target), read(workspaceKey), read(excluded), read(contextPreferences)])

export function showContext(items: ContextItemView[], notes: (Message | string)[], key = contextKey()): void {
  const ex = new Set(read(excluded))
  const kept = read(contextShown).filter(item => ex.has(item.id) && !items.some(next => next.id === item.id))
  put(contextShown, [...items, ...kept])
  put(contextNotes, notes)
  set(contextError, null)
  set(contextFor, key)
}

let pending: AbortController | null = null
export function cancelContextPreview(): void {
  const controller = pending
  pending = null
  controller?.abort()
  set(contextLoading, false)
}

export async function previewContext(): Promise<void> {
  cancelContextPreview()
  const controller = new AbortController()
  pending = controller
  const key = contextKey()
  set(contextLoading, true)
  set(contextFor, null)
  set(contextError, null)
  const current = () => pending === controller && !controller.signal.aborted && key === contextKey()
  try {
    const answer = await plugin.request('context.preview', {
      prompt: read(draft), level: read(effectiveLevel), terminalId: read(target), exclude: read(excluded), ...knownWorkspaceId()
    }, { timeoutMs: 60_000, signal: controller.signal })
    if (current()) showContext(answer.context, answer.notes, key)
  } catch (error) {
    if (current()) {
      set(contextError, message(error))
      set(contextFor, key)
    }
  } finally {
    if (pending === controller) { pending = null; set(contextLoading, false) }
  }
}

/** Refresh only while visible, debounce typing, and never let preview block Enhance. */
export function watchContextPreview(): () => void {
  let key = contextKey()
  let wasOpen = read(optionsOpen)
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = () => {
    const open = read(optionsOpen)
    const closing = wasOpen && !open
    wasOpen = open
    const next = contextKey()
    if (next !== key) {
      key = next
      clearTimeout(timer)
      timer = undefined
      cancelContextPreview()
    }
    if (!open || read(busy)) {
      clearTimeout(timer)
      timer = undefined
      if (pending && (closing || read(busy))) cancelContextPreview()
      return
    }
    if (read(contextLoading) || read(contextFor) === key || timer) return
    timer = setTimeout(() => { timer = undefined; void previewContext() }, 300)
  }
  const unsubscribe = subscribe(changed)
  changed()
  return () => { unsubscribe(); clearTimeout(timer); cancelContextPreview() }
}
