// Screenshots of the web panel's dev server (cd web && npm run dev) with headless Brave:
// node scripts/shot-web.mjs [out.png] [width] [height] [query]. Used to check a layout change.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'

const [out = '.artifacts/web.png', width = '400', height = '700', query = 'lang=vi'] = process.argv.slice(2)
const browsers = [process.env.BRAVE_PATH, 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'].filter(Boolean)
const browser = browsers.find((path) => existsSync(path))
if (!browser) throw new Error('No Brave found')
mkdirSync(dirname(resolve(out)), { recursive: true })
execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shot-web-'))}`,
  `--virtual-time-budget=${process.env.SHOT_WAIT_MS ?? 5000}`,
  `--window-size=${width},${height}`,
  `--screenshot=${resolve(out)}`,
  `http://localhost:5174/?${query}`
], { stdio: 'ignore' })
console.log(resolve(out))
