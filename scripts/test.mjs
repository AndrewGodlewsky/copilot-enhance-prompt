import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name)
    return entry.isDirectory() && entry.name !== 'web-dist' ? tests(file) : /\.test\.(ts|mjs)$/.test(file) ? [file] : []
  })
}
const result = spawnSync(process.execPath, ['--test', '--test-timeout=300000', ...tests('src'), ...tests('scripts'), ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true })
process.exitCode = result.status ?? 1
