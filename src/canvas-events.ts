export type CanvasConnection = 'connecting' | 'connected' | 'reconnecting' | 'unavailable'
type Options = {
  connect(signal: AbortSignal): Promise<Response>
  event(value: unknown): void
  state(value: CanvasConnection): void
  idleMs?: number
  retryMs?: number
}

/** Retries only the event subscription. Commands and saves never enter this loop. */
export function createCanvasEvents(options: Options) {
  let closed = false, terminal = false, active: AbortController | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined, retrying = false, failures = 0
  const retryMs = options.retryMs ?? 2000, idleMs = options.idleMs ?? 45_000
  const attempt = async () => {
    if (closed || terminal || active) return
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = undefined; retrying = false
    const controller = new AbortController(); active = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    let reader: ReadableStreamDefaultReader<string> | undefined
    const arm = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => controller.abort(), idleMs) }
    options.state('connecting'); arm()
    try {
      const response = await options.connect(controller.signal)
      if ([401, 403, 404, 410].includes(response.status)) { terminal = true; return }
      if (!response.ok || !response.body) throw new Error('Disconnected')
      controller.signal.throwIfAborted()
      reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      options.state('connected')
      let pending = ''
      while (!closed) {
        const next = await reader.read()
        controller.signal.throwIfAborted()
        if (next.done) break
        arm()
        pending += next.value
        let end: number
        while ((end = pending.indexOf('\n\n')) >= 0) {
          if (end > 64 * 1024) throw new Error('Invalid event frame')
          const line = pending.slice(0, end); pending = pending.slice(end + 2)
          if (line.startsWith('data: ')) options.event(JSON.parse(line.slice(6)))
        }
        if (pending.length > 64 * 1024) throw new Error('Invalid event frame')
        // Receiving data/heartbeats proves this attempt progressed beyond headers.
        failures = 0
      }
    } catch { /* The caller exposes state; never retain raw fetch/frame error text. */ }
    finally {
      if (timer) clearTimeout(timer)
      controller.abort()
      await reader?.cancel().catch(() => {})
      active = undefined
      if (!closed) {
        options.state(terminal ? 'unavailable' : 'reconnecting')
        if (!terminal) {
          retrying = true
          retryTimer = setTimeout(() => { void attempt() }, Math.min(30_000, retryMs * 2 ** Math.min(failures++, 4)))
        }
      }
    }
  }
  void attempt()
  return {
    retry() { if (retrying && !closed && !terminal) void attempt() },
    close() { closed = true; if (retryTimer) clearTimeout(retryTimer); active?.abort() }
  }
}
