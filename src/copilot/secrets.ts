import { spawn } from 'node:child_process'
import type { EnhanceWorker } from '../host.ts'
import type { PersistentStore } from './storage.ts'

// Values travel only over stdin/stdout, never command arguments or environment variables.
const SCRIPT = `Add-Type -AssemblyName System.Security
$r = [Console]::In.ReadToEnd() | ConvertFrom-Json
$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
if ($r.action -eq 'protect') {
  $bytes = [Text.Encoding]::UTF8.GetBytes($r.value)
  $out = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)
  [Console]::Out.Write([Convert]::ToBase64String($out))
} else {
  $bytes = [Convert]::FromBase64String($r.value)
  $out = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($out))
}`

export function protectedSecrets(store: PersistentStore): EnhanceWorker['secrets'] & { available: boolean } {
  const available = process.platform === 'win32'
  async function crypt(action: 'protect' | 'unprotect', value: string): Promise<string> {
    if (!available) throw new Error('OS-protected key storage is unavailable on this platform.')
    if (value.length > 16_384) throw new Error('API key is too long.')
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', SCRIPT], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
      let output = ''
      const timer = setTimeout(() => { child.kill(); reject(new Error('The protected key store timed out.')) }, 10_000)
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => { output += chunk; if (output.length > 65_536) child.kill() })
      child.on('error', () => { clearTimeout(timer); reject(new Error('The protected key store is unavailable.')) })
      child.on('close', code => { clearTimeout(timer); if (code !== 0 || !output) reject(new Error('The protected key store could not read or write this key.')); else resolve(output) })
      child.stdin.on('error', () => {})
      child.stdin.end(JSON.stringify({ action, value }))
    })
  }
  return {
    available,
    get: async key => { const value = await store.get(key); return typeof value === 'string' ? crypt('unprotect', value) : null },
    set: async (key, value) => { const encrypted = await crypt('protect', value); await store.set(key, encrypted) },
    delete: key => store.delete(key)
  }
}
