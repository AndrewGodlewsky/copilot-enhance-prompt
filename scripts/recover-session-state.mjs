// Maintainer-assisted offline export. Never restores, deletes or uploads saved data.
import { lstat, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { persistentStore } from '../src/copilot/storage.ts'
import { SESSION_LAYOUT_KEY } from '../src/copilot/session-storage.ts'

export async function exportLegacySessions({ directory, output, copilotClosed = false }) {
  if (!copilotClosed) throw new Error('First close Copilot completely, back up its plugin data, and confirm with --copilot-closed.')
  if (!directory || !output) throw new Error('Provide the plugin data directory and a new private export filename.')
  const root = resolve(directory), dataRoot = join(root, 'data'), sessions = join(dataRoot, 'sessions')
  const regular = async (path, folder = false) => {
    const info = await lstat(path)
    if (info.isSymbolicLink() || (folder ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) throw new Error('Recovery requires original regular files and directories, without links.')
  }
  await regular(root, true); await regular(dataRoot, true); await regular(join(dataRoot, 'state.json'))
  const data = persistentStore(dataRoot)
  return data.transaction(async () => {
    const saved = await data.snapshot()
    if (saved[SESSION_LAYOUT_KEY] !== 1) throw new Error('Unsupported session storage format; keep the original files for maintainer recovery.')
    await regular(sessions, true).catch(error => { if (error.code !== 'ENOENT') throw error })
    const files = await readdir(sessions, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error })
    for (const file of files) {
      if (!/^[a-f0-9]{24}\.json$/.test(file.name)) continue
      await regular(join(sessions, file.name))
      const store = persistentStore(sessions, file.name)
      const values = await store.transaction(() => store.snapshot())
      for (const [key, value] of Object.entries(values)) {
        if (!/^panel:.+/.test(key)) throw new Error('Unrecognized session key; keep the original files for maintainer recovery.')
        const legacy = `session:${file.name.slice(0, -5)}:${key}`
        if (Object.hasOwn(saved, legacy) && !isDeepStrictEqual(saved[legacy], value)) throw new Error('Recovery found conflicting old and new session values. Neither copy was changed.')
        saved[legacy] = value
      }
    }
    delete saved[SESSION_LAYOUT_KEY]
    // wx prevents replacing an original store or an earlier export.
    await writeFile(resolve(output), JSON.stringify(saved), { flag: 'wx', mode: 0o600 })
    return { sessionFiles: files.filter(file => /^[a-f0-9]{24}\.json$/.test(file.name)).length }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, output, flag] = process.argv.slice(2)
  try {
    await exportLegacySessions({ directory, output, copilotClosed: flag === '--copilot-closed' })
    console.log('Private recovery export created. Keep it local; it contains saved prompt data. No live files were replaced.')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
