import type { KeyValueStore } from './runtime.ts'
import { compareVersions } from './updates/version.ts'
import { VERSION } from './version.ts'

export const RELEASE_SEEN_KEY = 'releaseHistory.seenVersion'

/** Called inside the shared storage transaction. Only the running build's version is recorded. */
export async function claimReleaseHistory(storage: KeyValueStore, version = VERSION): Promise<{ version: string; show: boolean }> {
  if (compareVersions(version, version) === null) throw new Error('The running plugin version is invalid.')
  const previous = await storage.get(RELEASE_SEEN_KEY)
  const order = compareVersions(version, previous)
  // Missing/invalid old metadata establishes a baseline. Older canvases never rewind it.
  if (order === null || order > 0) await storage.set(RELEASE_SEEN_KEY, version)
  return { version, show: order !== null && order > 0 }
}
