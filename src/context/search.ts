import { readText, rememberHit, type FileFilter } from './files.ts'

/** Bounded fallback when Git search is unavailable; callers put likely paths first. */
export async function searchFiles(root: string, files: string[], words: string[], allow: FileFilter, signal?: AbortSignal) {
  const counts = words.map(() => new Map<string, number>())
  const hits = new Map<string, number[]>()
  let read = 0
  let bytes = 0
  const started = Date.now()
  for (const file of words.length ? files : []) {
    if (signal?.aborted || read >= 300 || bytes >= 4_000_000 || Date.now() - started >= 1500) break
    read++
    const text = await readText(root, file, Math.min(200_000, 4_000_000 - bytes), allow)
    if (text === null) continue
    bytes += Buffer.byteLength(text)
    const lines: number[] = []
    text.split(/\r?\n/).forEach((line, index) => {
      const lower = line.toLowerCase()
      let matched = false
      words.forEach((word, wordIndex) => {
        if (lower.includes(word.toLowerCase())) {
          counts[wordIndex].set(file, (counts[wordIndex].get(file) ?? 0) + 1)
          matched = true
        }
      })
      if (matched) rememberHit(lines,index + 1)
    })
    if (lines.length) hits.set(file, lines)
  }
  return { counts, hits, limited: words.length > 0 && read < files.length }
}
