import { read, set, subscribe } from '../../src/runtime.ts'
import { currentTheme, systemDark } from '../../src/panel/appearance.ts'

/** Start after saved preferences load, before mounting React. */
export function followTheme(media: MediaQueryList, root: HTMLElement): () => void {
  let applied: string | undefined
  const systemChanged = () => set(systemDark, media.matches)
  const apply = () => {
    const theme = read(currentTheme)
    if (theme === applied) return
    applied = theme
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }
  systemChanged()
  apply()
  const stop = subscribe(apply)
  media.addEventListener('change', systemChanged)
  return () => { stop(); media.removeEventListener('change', systemChanged) }
}
