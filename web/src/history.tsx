import { Fragment, useEffect, useRef, useState } from 'react'
import { read, set } from '#panel'
import { CopyIcon, DownloadIcon, EllipsisIcon, FolderIcon, PencilIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import type { HistoryEntry } from '../../src/history.ts'
import { isStyle, STYLE_LABELS } from '../../src/prompts.ts'
import { historyExcerpt, historyMatchParts, historyTitle } from '../../src/panel/history.ts'
import { clearHistory, copy, exportHistory, removeEntry, reuse } from '../../src/panel/actions.ts'
import {
  confirmClearHistory, filteredHistory, history, historyFilter, historyOpen, historyOrder,
  historyPageNumber, historyProject, historyProjectChoices, historyScope, historyWindow
} from '../../src/panel/state.ts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Pick } from './common'
import './history.css'

function Highlight({ text }: { text: string }) {
  return historyMatchParts(text, read(historyFilter)).map((part, index) => part.match
    ? <mark key={index}>{part.text}</mark>
    : <Fragment key={index}>{part.text}</Fragment>)
}

const styleName = (entry: HistoryEntry) => STYLE_LABELS[isStyle(entry.style) ? entry.style : 'balanced']
const validDate = (at: number) => Number.isFinite(at) && Number.isFinite(new Date(at).getTime())
const date = (at: number) => validDate(at) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(at) : 'Unknown date'
const ago = (at: number) => {
  if (!validDate(at)) return 'Unknown date'
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000))
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  return minutes < 60 ? format.format(-minutes, 'minute') : minutes < 1440 ? format.format(-Math.round(minutes / 60), 'hour') : format.format(-Math.round(minutes / 1440), 'day')
}

type SavedText = 'original' | 'enhanced'

export function HistoryReader({ entry, text, onTextChange }: { entry: HistoryEntry; text: SavedText; onTextChange: (text: SavedText) => void }) {
  return (
    <section className="history-reader" aria-label="Selected prompt">
      <h3><Highlight text={historyTitle(entry)} /></h3>
      <div className="history-details">
        <span>{styleName(entry)}</span><span>{entry.model}</span><time>{date(entry.at)}</time>
        {entry.source === 'hook' ? <span>Chat auto-enhance (legacy)</span> : null}
      </div>
      <details className="history-location">
        <summary>Project location</summary>
        <p>{entry.project || 'This older entry has no saved project.'}</p>
      </details>
      <div className="history-actions">
        <Button size="sm" title="Open both saved texts in Enhance" onClick={() => reuse(entry)}><PencilIcon />Reuse</Button>
        <Button size="sm" variant="ghost" title="Copy the enhanced prompt" onClick={() => void copy(entry.enhanced)}><CopyIcon />Copy</Button>
        <Button size="sm" variant="ghost" className="text-destructive" title="Delete this history entry" onClick={() => void removeEntry(entry.id)}><Trash2Icon />Delete</Button>
      </div>
      <div className="history-text-tabs" role="group" aria-label="Which saved text to read">
        <button type="button" aria-pressed={text === 'enhanced'} onClick={() => onTextChange('enhanced')}>Enhanced prompt</button>
        <button type="button" aria-pressed={text === 'original'} onClick={() => onTextChange('original')}>Original request</button>
      </div>
      <div className="history-prompt-text" tabIndex={0} aria-label={text === 'enhanced' ? 'Enhanced prompt' : 'Original request'} key={`${entry.id}:${text}`}><Highlight text={entry[text]} /></div>
      <p className="history-read-hint">Reuse opens this in Enhance. It does not send it.</p>
    </section>
  )
}

export function HistorySection() {
  const all = read(history)
  const query = read(historyFilter)
  const project = read(historyProject)
  const choices = read(historyProjectChoices)
  const window = read(historyWindow)
  const order = read(historyOrder)
  const selected = window.selected
  const scope = project === null ? 'all' : project ? `path:${project}` : 'unassigned'
  const allMatches = choices.reduce((count, choice) => count + choice.count, 0)
  const [reading, setReading] = useState<{ id: string; text: SavedText } | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  // React keeps the list and its scroll on selection; a changed filter or page starts at the top.
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0 }, [scope, query, order, window.page])
  const resetPage = () => { set(historyPageNumber, 1); set(historyOpen, null) }
  const chooseProject = (value: string) => { set(historyScope, value); resetPage() }

  return (
    <div className="history-screen">
      <div className="history-heading">
        <div><h2>History</h2><p>Find a prompt. Pick up where you left off.</p></div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label="More history actions">More<EllipsisIcon /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={read(filteredHistory).length === 0} onSelect={() => void exportHistory()}><DownloadIcon />Save as a file</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={all.length === 0} onSelect={() => set(confirmClearHistory, true)}><Trash2Icon />Clear history</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="history-toolbar">
        <div className="history-search"><SearchIcon className="size-4" aria-hidden="true" /><Input type="search" aria-label="Search original and enhanced prompts" placeholder="Search original and enhanced prompts" value={query} onChange={event => { set(historyFilter, event.target.value); resetPage() }} /></div>
        <div className="history-project-select"><Pick label="Filter history by project" value={scope} options={[{ value: 'all', label: `All projects (${allMatches})` }, ...choices.map(choice => ({ value: choice.value, label: `${choice.label}${choice.current ? ' · Current' : ''} (${choice.count})` }))]} onChange={chooseProject} /></div>
        <div className="history-order"><span aria-hidden="true">Order</span><Pick label="Order prompts" value={order} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} onChange={value => { set(historyOrder, value === 'oldest' ? 'oldest' : 'newest'); resetPage() }} /></div>
      </div>
      <div className="history-library">
        <aside className="history-projects" aria-label="Projects">
          <h3>Projects</h3>
          <button type="button" className="history-project" aria-pressed={scope === 'all'} onClick={() => chooseProject('all')}><FolderIcon className="size-4" /><span className="history-project-name">All projects</span><span className="history-count">{allMatches}</span></button>
          <div className="history-project-divider" />
          {choices.map(choice => (
            <button type="button" className="history-project" key={choice.value} aria-pressed={scope === choice.value} onClick={() => chooseProject(choice.value)} title={choice.path || 'Older entries without a project'}>
              <FolderIcon className="size-4" />
              <span className="history-project-name"><span>{choice.name}</span>{choice.detail ? <small>{choice.detail}</small> : null}{choice.current ? <small>Current project</small> : null}</span>
              <span className="history-count">{choice.count}</span>
            </button>
          ))}
        </aside>
        <section className="history-entries" aria-label="Saved prompts">
          <div className="history-list-heading"><span>{project === null ? 'All prompts' : choices.find(choice => choice.path === project)?.name}</span><span>{window.total} {query.trim() ? 'matches' : 'saved'}</span></div>
          <div className="history-list-scroll" ref={scroll}>
            {window.entries.map(entry => (
              <button type="button" className="history-entry" key={entry.id} aria-pressed={selected?.id === entry.id} onClick={() => { set(historyOpen, entry.id); setReading(null) }}>
                <span className="history-entry-title"><Highlight text={historyTitle(entry)} /></span>
                <span className="history-entry-excerpt"><Highlight text={historyExcerpt(entry)} /></span>
                <span className="history-entry-meta"><span title={entry.project || 'No project recorded'}>{project === null ? choices.find(choice => choice.path === (entry.project || ''))?.label : styleName(entry)}</span><time title={date(entry.at)}>{ago(entry.at)}</time></span>
                {query.trim() && !entry.original.toLowerCase().includes(query.trim().toLowerCase()) ? <span className="history-match-note">Match in enhanced prompt</span> : null}
              </button>
            ))}
            {window.total === 0 ? <div className="history-empty"><strong>{all.length ? 'No matching prompts' : 'No history yet'}</strong><p>{all.length ? 'Try another project or a shorter search.' : 'Enhanced prompts show up here.'}</p></div> : null}
          </div>
        </section>
        {selected ? <HistoryReader entry={selected} text={reading?.id === selected.id ? reading.text : 'enhanced'} onTextChange={text => setReading({ id: selected.id, text })} /> : <div className="history-empty history-reader-empty"><p>{all.length ? 'Select a matching prompt to read it here.' : 'Your saved prompts will be available to read and reuse here.'}</p></div>}
      </div>
      <div className="history-pagination">
        <span aria-live="polite">{window.total ? `${window.start}–${window.end} of ${window.total}${query.trim() ? ' matching' : ''} prompts` : '0 prompts'}</span>
        <div><Button variant="ghost" size="sm" disabled={window.page === 1} onClick={() => { set(historyPageNumber, window.page - 1); set(historyOpen, null) }}>Previous</Button><span>{window.page} / {window.pages}</span><Button variant="ghost" size="sm" disabled={window.page === window.pages} onClick={() => { set(historyPageNumber, window.page + 1); set(historyOpen, null) }}>Next</Button></div>
      </div>
      <Dialog open={read(confirmClearHistory)} onOpenChange={open => set(confirmClearHistory, open)}>
        <DialogContent><DialogHeader><DialogTitle>Clear all history?</DialogTitle><DialogDescription>This removes saved prompts from every project, including entries hidden by your search. Your current request and saved settings stay unchanged.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => set(confirmClearHistory, false)}>Cancel</Button><Button variant="destructive" onClick={() => void clearHistory()}>Clear all history</Button></div></DialogContent>
      </Dialog>
    </div>
  )
}
