import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
let own: Promise<string | undefined> | undefined

/** OS process creation identity, not its reusable PID. Failure means unknown, never dead. */
export async function processIdentity(pid: number): Promise<string | undefined> {
  if (!Number.isSafeInteger(pid) || pid < 1) return undefined
  if (pid === process.pid) return own ??= inspect(pid)
  return inspect(pid)
}

async function inspect(pid: number): Promise<string | undefined> {
  try {
    if (process.platform === 'win32') {
      if (!process.env.SystemRoot) return undefined
      const executable = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      const { stdout } = await execute(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`], { windowsHide: true, timeout: 2000, maxBuffer: 4096 })
      const ticks = stdout.trim()
      return /^\d{16,20}$/.test(ticks) ? `win:${ticks}` : undefined
    }
    if (process.platform === 'linux') {
      const [stat, boot] = await Promise.all([readFile(`/proc/${pid}/stat`, 'utf8'), readFile('/proc/sys/kernel/random/boot_id', 'utf8')])
      // Field 22 follows the parenthesized process name (which can contain spaces or parentheses).
      const started = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]
      return /^\d+$/.test(started) && /^[0-9a-f-]{36}$/i.test(boot.trim()) ? `linux:${boot.trim()}:${started}` : undefined
    }
  } catch { /* Missing permissions, tools or process state must not authorize reservation expiry. */ }
  return undefined
}
