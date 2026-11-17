import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const GENERATED = ['com.github.copilot', 'src/web-dist', 'runtime-inventory.json', 'THIRD_PARTY_NOTICES.md']
export function changedGenerated(cwd = process.cwd()) {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...GENERATED], { cwd, encoding: 'utf8', windowsHide: true }).trim()
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = changedGenerated()
  if (changed) { console.error('Generated artifacts differ from the committed build. Rebuild, review and commit them:\n' + changed); process.exitCode = 1 }
  else console.log('PASS: regenerated extension, panel, notices and inventory match the committed files.')
}
