import { randomUUID } from 'node:crypto'
import type { JsonValue, KeyValueStore } from '../runtime.ts'
import type { Available, Installation, UpdateClient, UpdateView } from './types.ts'
import { compareVersions } from './version.ts'
import { UpdateError } from './metadata.ts'
import { processIdentity } from './process-owner.ts'

const DAY = 86_400_000
type Owner = { pid: number; identity?: string }
type Pending = Owner & { id: string; started: number; version: string }
type State = {
  scope?: string; automatic?: boolean; checkedAt?: number; nextCheck?: number; retryAt?: number; failures?: number
  available?: Available; dismissed?: string; error?: string; unavailable?: boolean
  completedCheck?: string
  check?: { id: string; until: number }; pending?: Pending; work?: Record<string, number | Owner>
}
type Options = {
  running: string; store: KeyValueStore & { transaction<T>(fn: () => Promise<T>): Promise<T> }
  installation(): Promise<Installation>; metadata(installation: Installation): Promise<Available>
  update(target: string): Promise<unknown>; busy?(): boolean; now?: () => number; pid?: number
  alive?: (pid: number) => boolean; updateTimeoutMs?: number
  identity?: (pid: number) => Promise<string | undefined>
  record?: (operation: string, outcome: 'started' | 'ok' | 'failed' | 'pending', code?: string) => void
}
export const RELOAD_MESSAGE = 'Update installed. Restart Copilot, then reopen this session and Enhance Prompt to keep your saved draft. A new session also loads the update; reopening only this tab does not.'
const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM' } }
export function deadline<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new UpdateError('The update operation timed out.', 'timeout')), ms) })]).finally(() => clearTimeout(timer))
}

export function createUpdates(options: Options): UpdateClient & { withWork<T>(run: () => Promise<T>): Promise<T> } {
  const now = options.now ?? Date.now, pid = options.pid ?? process.pid, isAlive = options.alive ?? alive
  // Tests supplying synthetic liveness also supply their own creation identities when needed.
  const identity = options.identity ?? (options.alive ? async () => undefined : processIdentity)
  let ownIdentity: Promise<string | undefined> | undefined
  const confirmed = new Map<number, { identity: string; until: number }>()
  const own = async (): Promise<Owner> => {
    const value = await (ownIdentity ??= identity(pid).catch(() => undefined))
    return { pid, ...(value ? { identity: value } : {}) }
  }
  const living = async (owner: number | Owner, reads = new Map<number, Promise<string | undefined>>()) => {
    const item = typeof owner === 'number' ? { pid: owner } : owner
    if (!isAlive(item.pid)) return false
    if (!item.identity) return true // Legacy PID-only reservations cannot prove PID reuse.
    const cached = confirmed.get(item.pid)
    // Cache only positive matches. A reused PID can delay recovery by five seconds, never release live work.
    if (cached?.identity === item.identity && cached.until > performance.now()) return true
    if (!reads.has(item.pid)) reads.set(item.pid, item.pid === pid ? own().then(value => value.identity) : identity(item.pid).catch(() => undefined))
    const current = await reads.get(item.pid)
    if (current === item.identity) {
      if (confirmed.size >= 128) confirmed.delete(confirmed.keys().next().value!)
      confirmed.set(item.pid, { identity: current, until: performance.now() + 5000 })
    }
    return current === undefined || current === item.identity
  }
  const liveWork = async (work: State['work']) => {
    const reads = new Map<number, Promise<string | undefined>>()
    const entries = await Promise.all(Object.entries(work ?? {}).map(async ([id, owner]) => await living(owner, reads) ? [id, owner] as const : null))
    return Object.fromEntries(entries.filter(entry => entry !== null))
  }
  const get = async () => (await options.store.get('state') ?? {}) as State
  const put = (state: State) => options.store.set('state', state as JsonValue)
  const mutate = <T>(fn: (state: State) => Promise<T>) => options.store.transaction(async () => fn(await get()))
  const inspect = () => deadline(options.installation(), 8_000)
  const record = options.record ?? (() => {})
  let checking: Promise<UpdateView> | undefined
  const view = (state: State, installation: Installation): UpdateView => {
    const base = { running: options.running, installed: installation.installed, available: state.available?.version, changes: state.available?.changes,
      automatic: state.automatic !== false, dismissed: !!state.available && state.dismissed === state.available.version, checkedAt: state.checkedAt, canUpdate: false }
    if (state.pending) return { ...base, status: 'updating', message: now() - state.pending.started > 90_000
      ? 'Copilot has not confirmed the update yet. Inspect Customize → Installed and restart Copilot before retrying. Reopening will verify the installed version.'
      : 'Copilot is updating Enhance Prompt. If the connection closes, reopen the plugin to verify the result. Do not start another update.' }
    const running = compareVersions(installation.installed, options.running)
    if (installation.source && installation.target && running !== null && running > 0) return { ...base, status: 'reload', message: RELOAD_MESSAGE }
    if (!installation.source || !installation.target || state.unavailable) return { ...base, status: 'unavailable', message: installation.reason ?? state.error ?? 'Automatic updating is unavailable for this installation.' }
    if (state.check) return { ...base, status: 'checking', message: 'Checking for updates…' }
    if (state.error) return { ...base, status: 'failed', message: state.error }
    const available = compareVersions(state.available?.version, installation.installed)
    if (running === null || available === null) return { ...base, status: 'unknown', message: 'Unable to determine whether this installation is current.' }
    if (running < 0) return { ...base, status: 'unknown', message: 'The installed version is older than this running canvas. Review the installation in Copilot.' }
    if (available > 0) return { ...base, status: 'available', message: `Enhance Prompt ${state.available!.version} is available.`, canUpdate: installation.canUpdate }
    return { ...base, status: 'current', message: 'Running the current version for this source.' }
  }
  async function reconcile(installation: Installation) {
    return mutate(async state => {
      if (installation.source && installation.target && state.scope !== installation.scope && !state.pending) {
        state = { automatic: state.automatic, scope: installation.scope, work: state.work }
      }
      if (state.check && state.check.until <= now()) delete state.check
      if (state.pending && !await living(state.pending)) {
        const installed = compareVersions(installation.installed, state.pending.version)
        state.error = installed !== null && installed >= 0 ? undefined : 'The previous update was interrupted or could not be verified. Review the installed version, then check again before retrying.'
        delete state.pending
      }
      await put(state)
      return state
    })
  }
  async function state() { const installation = await inspect(); return view(await reconcile(installation), installation) }
  async function performCheck(manual: boolean) {
    const previous = await get()
    const installation = await inspect()
    await reconcile(installation)
    const id = randomUUID()
    const reserved = await mutate(async state => {
      const changedSource = previous.scope !== undefined && previous.scope !== installation.scope
      const sharedResult = !changedSource && state.completedCheck !== previous.completedCheck || state.checkedAt !== undefined && now() - state.checkedAt < 5000
      const notDue = !manual && (state.automatic === false || (state.nextCheck ?? 0) > now()) || (state.retryAt ?? 0) > now()
      if (state.pending || state.check || sharedResult || notDue) return false
      if (!installation.source || compareVersions(installation.installed, options.running) === 1) return false
      state.check = { id, until: now() + 120_000 }; state.nextCheck = now() + DAY; state.error = undefined; state.unavailable = false
      await put(state); return true
    })
    if (!reserved) return view(await get(), installation)
    record('updates.check', 'started')
    try {
      const available = await deadline(options.metadata(installation), 60_000)
      await mutate(async state => {
        if (state.check?.id !== id || state.scope !== installation.scope) return
        state.available = available; state.checkedAt = now(); state.completedCheck = id; state.failures = 0; state.retryAt = 0
        delete state.check; delete state.error; await put(state)
      })
      record('updates.check', 'ok')
    } catch (error) {
      const safe = error instanceof UpdateError ? error : new UpdateError('Unable to check for updates. Try again later.', 'network')
      await mutate(async state => {
        if (state.check?.id !== id) return
        state.failures = Math.min(8, (state.failures ?? 0) + 1)
        state.retryAt = now() + Math.max(safe.retryAfter, Math.min(DAY, 60_000 * 2 ** (state.failures - 1)))
        state.error = safe.message; state.unavailable = ['pinned', 'source_changed'].includes(safe.code)
        delete state.check; await put(state)
      })
      record('updates.check', 'failed', safe.code)
    }
    return view(await get(), installation)
  }
  async function verify(pending: Pending, installation: Installation, failed: boolean) {
    let after: Installation | undefined
    try { after = await inspect() } catch {}
    await mutate(async state => {
      if (state.pending?.id !== pending.id) return
      const comparison = compareVersions(after?.installed, pending.version)
      const verified = !!after?.source && !!after.target && after.scope === installation.scope && comparison !== null && comparison >= 0
      state.error = verified ? undefined : failed
        ? 'Copilot did not complete this update. A policy refusal or required confirmation must be resolved in Copilot. No alternate installation route was used.'
        : 'Copilot returned, but the installed version does not match the update. Review the installation in Copilot and check again.'
      delete state.pending
      await put(state)
      record('updates.install', verified ? 'ok' : 'failed', verified ? undefined : 'action_failed')
    })
  }
  async function install() {
    const installation = await inspect()
    const current = await reconcile(installation)
    if (current.pending) return view(current, installation)
    // Repeat metadata validation: a stale notice cannot authorize a newly changed marketplace source.
    if (!installation.canUpdate || !installation.target || !installation.source) throw new UpdateError(installation.reason ?? 'Updating is unavailable for this installation.')
    if (compareVersions(installation.installed, options.running) === -1) throw new UpdateError('The installed version is older than this canvas. Review the installation in Copilot before updating.')
    const available = await deadline(options.metadata(installation), 60_000)
    const pending: Pending = { id: randomUUID(), ...await own(), started: now(), version: available.version }
    const reserved = await mutate(async state => {
      if (state.pending) return false
      if (state.scope !== installation.scope) throw new UpdateError('The installation source changed. Check for updates again.')
      state.work = await liveWork(state.work)
      if (options.busy?.() || Object.keys(state.work).length) throw new UpdateError('Finish active plugin work in all open canvases, then retry Update.')
      if (compareVersions(available.version, installation.installed) !== 1 || compareVersions(installation.installed, options.running) === 1) return false
      state.pending = pending; state.available = available; delete state.error; await put(state); return true
    })
    if (!reserved) return state()
    record('updates.install', 'started')
    // Do not cancel installation when an HTTP connection closes. The durable journal owns recovery.
    const operation = Promise.resolve().then(async () => {
      const fresh = await inspect()
      if (fresh.scope !== installation.scope || fresh.installed !== installation.installed || !fresh.canUpdate) throw new UpdateError('Installation changed before update.')
      await options.update(installation.target!)
    }).then(() => verify(pending, installation, false), () => verify(pending, installation, true))
    try { await deadline(operation, options.updateTimeoutMs ?? 90_000) }
    catch { record('updates.install', 'pending', 'timeout') }
    return state()
  }
  return {
    state,
    check(manual) { if (!checking) checking = performCheck(manual).finally(() => { checking = undefined }); return checking },
    install,
    async later() { await mutate(async state => { state.dismissed = state.available?.version; await put(state) }); return state() },
    async automatic(enabled) { await mutate(async state => { state.automatic = enabled; await put(state) }); return state() },
    async withWork(run) {
      const id = randomUUID()
      const owner = await own()
      await mutate(async state => {
        if (state.pending) throw new UpdateError('An update is in progress. Wait for verification before starting more plugin work.')
        state.work = await liveWork(state.work)
        state.work[id] = owner; await put(state)
      })
      const release = async () => {
        if (options.busy?.()) { const timer = setTimeout(() => { void release().catch(() => {}) }, 1000); timer.unref(); return }
        await mutate(async state => { delete state.work?.[id]; await put(state) })
      }
      try { return await run() } finally { await release() }
    }
  }
}
