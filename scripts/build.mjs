import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const web = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'web'], { stdio: 'inherit' })
if (web.status !== 0) process.exit(web.status ?? 1)
const vite = spawnSync(process.execPath, ['web/node_modules/vite/bin/vite.js', 'build', '--config', 'web/vite.config.ts'], { cwd: process.cwd(), stdio: 'inherit', env: process.env })
if (vite.status !== 0) process.exit(vite.status ?? 1)
const directory = 'com.github.copilot/extensions/enhance-prompt'
await mkdir(directory, { recursive: true })
await build({ entryPoints: ['src/copilot/extension.ts'], outfile: `${directory}/extension.mjs`, bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['@github/copilot-sdk', '@github/copilot-sdk/extension'], banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }, legalComments: 'inline' })
await build({ entryPoints: ['src/copilot/hook-entry.ts'], outfile: 'com.github.copilot/hooks/hook.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" }, legalComments: 'inline' })
// Replace the generated web directory so deleted Vite chunks cannot survive an upgrade.
const packagedWeb = path.resolve(directory, 'web')
const relativeWeb = path.relative(process.cwd(), packagedWeb)
if (relativeWeb.startsWith('..') || path.isAbsolute(relativeWeb)) throw new Error('Packaged web directory must stay inside the project')
await rm(packagedWeb, { recursive: true, force: true })
await cp('src/web-dist', packagedWeb, { recursive: true })
console.log('Built the Copilot canvas extension and panel.')
