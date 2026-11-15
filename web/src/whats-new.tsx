import { formatText } from '../../src/format.ts'
// What's new and the changelog, from the English CHANGELOG.md (bundled as text, loaded when
// the dialog opens).
// The version is plain footer text; after an update the changelog opens once by itself.
import { useEffect, useState, type ReactNode } from 'react'
import { VERSION } from '../../src/version.ts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Segmented } from './common'

type Release = { version: string; date: string; body: string }

/** The releases in CHANGELOG.md, newest first: "## [X.Y.Z] - date" and what follows. */
export function parseChangelog(text: string): Release[] {
  const out: Release[] = []
  for (const part of text.split(/^## /m).slice(1)) {
    const match = /^\[([^\]]+)\](?:\s*-\s*(\S+))?\s*\n([\s\S]*)$/.exec(part)
    if (!match) continue
    // Drop the link list at the end of the file.
    const body = match[3].replace(/^\[[^\]]+\]:.*$/gm, '').trim()
    out.push({ version: match[1], date: match[2] ?? '', body })
  }
  return out
}

/** `code` and **bold** inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((piece, index) =>
    piece.startsWith('`') ? (
      <code key={index} className="bg-muted rounded px-1 font-mono text-[12px]">
        {piece.slice(1, -1)}
      </code>
    ) : piece.startsWith('**') ? (
      <strong key={index}>{piece.slice(2, -2)}</strong>
    ) : (
      piece
    )
  )
}

/** The small Markdown a changelog section uses: ### headings, - bullets, paragraphs. */
function ReleaseBody({ body }: { body: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul${blocks.length}`} className="ml-4 list-disc space-y-1">
        {bullets.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>
    )
    bullets = []
  }
  for (const line of body.split('\n')) {
    if (/^\s*- /.test(line)) bullets.push(line.replace(/^\s*- /, ''))
    else if (/^\s{2,}\S/.test(line) && bullets.length > 0) bullets[bullets.length - 1] += ` ${line.trim()}`
    else {
      flush()
      if (line.startsWith('### ')) blocks.push(<h4 key={`h${blocks.length}`} className="mt-2 text-sm font-semibold">{line.slice(4)}</h4>)
      else if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>)
    }
  }
  flush()
  return <div className="flex flex-col gap-1.5 text-sm leading-relaxed">{blocks}</div>
}

const SEEN_KEY = 'enhance-prompt:seen-version'

/** Loads the English changelog only when the dialog opens. */
async function loadChangelog(): Promise<Release[]> {
  return parseChangelog((await import('../../CHANGELOG.md?raw')).default)
}

/**
 * `?version=0` on the dev server leaves the version out of the footer: the listing's and the
 * README's pictures are drawn that way, since a number in them is out of date with the next
 * release. Never in the built panel.
 */
const versionHidden = import.meta.env.DEV && new URLSearchParams(location.search).get('version') === '0'

export function WhatsNew() {
  const [loaded, setLoaded] = useState<Release[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open && loaded === null) void loadChangelog().then(setLoaded)
  }, [open, loaded])
  const releases = loaded ?? []
  const [view, setView] = useState('new')
  // After an update (not on the first install), show what changed once.
  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY)
    if (seen && seen !== VERSION) setOpen(true)
    localStorage.setItem(SEEN_KEY, VERSION)
  }, [])
  const latest = releases.find((release) => release.version === VERSION) ?? releases[0]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {versionHidden ? null : (
        <span className="text-muted-foreground inline-flex min-h-8 items-center px-1 text-xs">
          {`v${VERSION}`}
        </span>
      )}
      <DialogContent className="flex max-h-[85vh] max-w-[calc(100vw-24px)] flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle>{view === 'new' ? formatText("What's new in {version}", { version: latest?.version ?? VERSION }) : 'Changelog'}</DialogTitle>
          <DialogDescription className="sr-only">{'Changelog'}</DialogDescription>
        </DialogHeader>
        <Segmented
          label={'Changelog'}
          value={view}
          options={[
            { value: 'new', label: "What's new" },
            { value: 'all', label: 'Changelog' }
          ]}
          onChange={setView}
        />
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {view === 'new' && latest ? (
            <ReleaseBody body={latest.body} />
          ) : (
            <div className="flex flex-col gap-4">
              {releases.map((release) => (
                <section key={release.version} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold">{`v${release.version}`}</h3>
                    <span className="text-muted-foreground text-xs">{release.date}</span>
                  </div>
                  <ReleaseBody body={release.body} />
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
