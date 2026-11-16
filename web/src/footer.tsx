import { BRAND } from '../../src/brand.ts'
import { REPOSITORY_URL, ISSUES_URL } from '../../src/panel/view.ts'
import { LogsButton } from './logs'
import { WhatsNew } from './whats-new'

const linkStyle = 'inline-flex min-h-8 items-center rounded px-1 text-xs text-blue-700 underline-offset-4 hover:underline dark:text-blue-400'

export function Footer({ onSettings }: { onSettings: () => void }) {
  return <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs">
    <a className={linkStyle} href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">{BRAND}</a>
    <WhatsNew />
    <button type="button" className={linkStyle} onClick={onSettings}>{'Settings'}</button>
    <LogsButton />
    <a className={linkStyle} href={ISSUES_URL} target="_blank" rel="noopener noreferrer">{'Feedback'}</a>
  </footer>
}
