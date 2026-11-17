import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { homedir } from 'node:os'
import { lstat, mkdir, open, realpath, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'

import { registerUsageJournal, recoverUsageJournals, type UsageRecoveryStatus } from './usage-recovery.ts'

export type UsageRecorder = { record(event: unknown): void; flush(): Promise<void>; stopped?(): Promise<void>; committed?(): Promise<void>; cleanup?(): Promise<void>; complete?(): Promise<void>; settled?(): Promise<void> }

type ObjectValue = Record<string, unknown>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const identifier = /^[a-z0-9][a-z0-9._:+\/-]*$/i
const numericFields = [
  'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens',
  'reasoningTokens', 'toolTokenCount', 'availableToolCount', 'totalTokens',
  'duration',
] as const

function object(value: unknown): ObjectValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : undefined
}

function safeId(value: unknown, max = 256): string | undefined {
  return typeof value === 'string' && value.length <= max && !value.includes('://') && identifier.test(value) ? value : undefined
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function metric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function project(event: unknown, sessionId: string): ObjectValue | undefined {
  const e = object(event)
  if (e?.type !== 'assistant.usage' && e?.type !== 'session.usage_record') return
  const data = e.type === 'session.usage_record' ? object(object(e.data)?.usage) : object(e.data)
  if (!data) throw new Error('Invalid usage accounting record.')
  const id = safeId(e.id)
  const timestamp = e.timestamp
  const ms = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN
  if (!id || !Number.isFinite(ms) || ms < Date.UTC(2020, 0, 1) || ms >= Date.UTC(2100, 0, 1)) throw new Error('Invalid usage accounting record.')

  const usage: ObjectValue = {}
  const model = safeId(data.model, 128)
  if (model) usage.model = model
  for (const field of numericFields) {
    const value = field === 'duration' ? metric(data[field]) : count(data[field])
    if (value !== undefined) usage[field] = value
  }
  if (typeof data.cacheDetailsReported === 'boolean') usage.cacheDetailsReported = data.cacheDetailsReported
  if (typeof data.isAuto === 'boolean') usage.isAuto = data.isAuto
  if (typeof data.isByok === 'boolean') usage.isByok = data.isByok
  if (typeof data.byokKind === 'string' && data.byokKind.length) {
    usage.byokKind = ['local_managed', 'local_user', 'remote_user'].includes(data.byokKind) ? data.byokKind : 'other'
  }
  const provider = object(data.provider)
  if (provider && (provider.kind !== undefined || provider.id !== undefined)) {
    usage.provider = { kind: provider.kind === 'copilot' ? 'copilot' : 'external' }
  }
  const copilotUsage = object(data.copilotUsage)
  const totalNanoAiu = count(copilotUsage?.totalNanoAiu)
  if (totalNanoAiu !== undefined) usage.copilotUsage = { totalNanoAiu }
  if (['complete', 'partial', 'unavailable'].includes(data.aiCreditsStatus as string)) usage.aiCreditsStatus = data.aiCreditsStatus

  const accounting = object(data.accounting)
  if (accounting?.sourceSessionId === sessionId) {
    const usageId = safeId(accounting.usageId)
    const sequence = count(accounting.sequence)
    if (usageId && sequence !== undefined) usage.accounting = { sourceSessionId: sessionId, usageId, sequence }
  }
  return { type: 'session.usage_record', id, timestamp: new Date(ms).toISOString(), data: { usage } }
}

// The child can outlive the live SDK listener. Its journal is the final source of receipts.
export async function reconcileUsageJournal(path: string, recorder: UsageRecorder): Promise<void> {
  const maxBytes = 64 * 1024 * 1024
  const decoder = new StringDecoder('utf8')
  let bytes = 0
  let remainder = ''
  let unreadable = false
  const consume = (line: string) => {
    if (!line.trim()) return
    let event: unknown
    try { event = JSON.parse(line) } catch { throw new Error('Unable to read usage accounting journal.') }
    if (object(event)?.type === 'session.usage_record') recorder.record(event)
  }
  try {
    for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
      bytes += chunk.length
      if (bytes > maxBytes) throw new Error('Unable to read usage accounting journal.')
      remainder += decoder.write(chunk)
      let newline: number
      while ((newline = remainder.indexOf('\n')) !== -1) {
        consume(remainder.slice(0, newline))
        remainder = remainder.slice(newline + 1)
      }
    }
    consume(remainder + decoder.end())
  } catch (error) {
    unreadable = (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
  // Even a malformed tail must settle earlier receipt writes before the caller releases its lock.
  await recorder.flush()
  if (unreadable) throw new Error('Unable to read usage accounting journal.')
}

async function replace(file: string, content: string): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, file)
}

export function usageHome(): string {
  return join(process.env.ENHANCE_PROMPT_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'copilot-enhance-prompt'), 'usage')
}

export async function createUsageRecorder(sessionId: string, root = usageHome(), options: { resume?: boolean; helperDirectory?: string } = {}): Promise<UsageRecorder> {
  if (!uuid.test(sessionId)) throw new Error('Invalid usage session ID.')
  const directory = join(root, 'session-state', sessionId)
  const file = join(directory, 'events.jsonl')
  const started = new Date().toISOString()
  await mkdir(join(root, 'session-state'), { recursive: true, mode: 0o700 })
  let lines = JSON.stringify({ type: 'session.start', id: randomUUID(), timestamp: started, data: { sessionId, context: { repository: 'Enhanced Prompt' } } }) + '\n'
  const seen = new Set<string>()
  const keyOf = (receipt: ObjectValue) => {
    const accounting = object(object(object(receipt.data)?.usage)?.accounting)
    return accounting ? `${sessionId}:${accounting.usageId}` : `event:${receipt.id}`
  }
  if (options.resume) {
    const canonical = await realpath(root)
    if (await realpath(directory) !== join(canonical, 'session-state', sessionId)) throw new Error('Unable to reopen usage accounting.')
    const before = await lstat(file, { bigint: true })
    if (!before.isFile() || before.nlink !== 1n || before.size > 64n * 1024n * 1024n) throw new Error('Unable to reopen usage accounting.')
    const handle = await open(file, 'r')
    let content: string
    try {
      const actual = await handle.stat({ bigint: true })
      if (!actual.isFile() || actual.nlink !== 1n || actual.dev !== before.dev || actual.ino !== before.ino) throw new Error('Unable to reopen usage accounting.')
      content = await handle.readFile('utf8')
    } finally { await handle.close() }
    const saved = content.trim().split('\n').map(line => JSON.parse(line))
    const head = saved.shift()
    if (head?.type !== 'session.start' || !safeId(head.id) || typeof head.timestamp !== 'string' || !Number.isFinite(Date.parse(head.timestamp)) || head?.data?.sessionId !== sessionId || head?.data?.context?.repository !== 'Enhanced Prompt') throw new Error('Unable to reopen usage accounting.')
    // Reconstruct only known receipts; never copy arbitrary journal contents into the accounting file.
    lines = JSON.stringify({ type: 'session.start', id: head.id, timestamp: new Date(head.timestamp).toISOString(), data: { sessionId, context: { repository: 'Enhanced Prompt' } } }) + '\n'
    for (const event of saved) {
      const receipt = project(event, sessionId)
      if (!receipt) throw new Error('Unable to reopen usage accounting.')
      const key = keyOf(receipt)
      if (!seen.has(key)) { seen.add(key); lines += JSON.stringify(receipt) + '\n' }
    }
  } else {
    await mkdir(directory, { mode: 0o700 })
    await replace(join(directory, 'workspace.yaml'), JSON.stringify({ id: sessionId, name: `Enhanced Prompt · ${started}` }) + '\n')
    await replace(file, lines)
  }
  const recovery = options.helperDirectory ? await registerUsageJournal(root, sessionId, options.helperDirectory) : undefined
  let pending = Promise.resolve()
  let failure = false
  return {
    ...recovery,
    record(event) {
      if (failure) return
      let receipt: ObjectValue | undefined
      try { receipt = project(event, sessionId) } catch { failure = true; return }
      if (!receipt) return
      const key = keyOf(receipt)
      if (seen.has(key)) return
      seen.add(key)
      pending = pending.then(async () => {
        const next = lines + JSON.stringify(receipt) + '\n'
        await replace(file, next)
        lines = next
      }).catch(() => { failure = true })
    },
    async flush() {
      await pending
      if (failure) throw new Error('Unable to save usage accounting.')
    },
  }
}

export async function recoverUsage(manual = false, root = usageHome(), inspect = false): Promise<UsageRecoveryStatus> {
  return recoverUsageJournals(root, async (sessionId, journal) => {
    const recorder = await createUsageRecorder(sessionId, root, { resume: true })
    await reconcileUsageJournal(journal, recorder)
    await recorder.flush()
  }, { manual, inspect })
}
