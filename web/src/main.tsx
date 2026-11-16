// The web panel's entry: starts the panel's state (src/panel/setup.ts wires Copilot's events to it), then
// draws the header and the current section.
import { lazy, StrictMode, Suspense, useReducer } from 'react'
import { createRoot } from 'react-dom/client'
import { onPersistenceError, read, set } from '#panel'
import { BookOpenIcon, BotIcon, ScrollTextIcon, SettingsIcon, SparklesIcon } from 'lucide-react'
import './index.css'
import './layout.css'
import { SECTION_LABELS } from '../../src/panel/view.ts'
import { BRAND } from '../../src/brand.ts'
import { busy, draft, files, history, historyOpen, notice, optionsOpen, put, say, sendAfterEnhance, tab } from '../../src/panel/state.ts'
import { msg } from '../../src/messages.ts'
import { previews } from './attach'
import { enhanceAndSend, enhanceNow, openSection, refreshTargets } from '../../src/panel/actions.ts'
import { closePanel, wirePanel } from '../../src/panel/setup.ts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Notices } from './common'
import { Button } from '@/components/ui/button'
import { Footer } from './footer'
import { LogsButton } from './logs'
import { panelDiagnostics } from '../../src/panel/diagnostics.ts'
import { diagnosticError } from '../../src/diagnostics.ts'
import { QuietDesk } from './quiet-desk'
import { followTheme } from './theme'
import { colorTheme } from '../../src/panel/appearance.ts'
import { ready, usePanel } from './panel-runtime'
import { EnhanceSection } from './enhance'
import { connectCanvas } from './transport'

// The Enhance section is drawn at once; the others load the first time they open (a smaller first load).
const loadSections = () => import('./sections')
const HistorySection = lazy(() => import('./history').then((module) => ({ default: module.HistorySection })))
const ModelsSection = lazy(() => loadSections().then((module) => ({ default: module.ModelsSection })))
const RulesSection = lazy(() => loadSections().then((module) => ({ default: module.RulesSection })))
const SettingsSection = lazy(() => loadSections().then((module) => ({ default: module.SettingsSection })))

const SECTIONS = [
  { value: 'enhance', Icon: SparklesIcon },
  { value: 'history', Icon: BookOpenIcon },
  { value: 'models', Icon: BotIcon },
  { value: 'rules', Icon: ScrollTextIcon },
  { value: 'privacy', Icon: SettingsIcon }
] as const

function App() {
  usePanel()
  // Uploads keep their own list outside the atoms; this redraws when it changes.
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  const current = SECTIONS.find((section) => section.value === read(tab)) ?? SECTIONS[0]
  return (
    <TooltipProvider delayDuration={300}>
      <div className="panel-shell mx-auto flex min-h-screen w-full flex-col gap-4 p-3 sm:p-4">
        <header className="flex flex-col gap-3">
          <QuietDesk />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <nav aria-label={'Plugin sections'} className="flex flex-wrap gap-1">
              {SECTIONS.map(({ value, Icon }) => (
                <Button
                  key={value}
                  size="sm"
                  aria-current={value === current.value ? 'page' : undefined}
                  variant={value === current.value ? 'secondary' : 'ghost'}
                  className={`h-9 gap-1 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm ${value === current.value ? 'ring-1 ring-border' : 'text-muted-foreground'}`}
                  onClick={() => openSection(value)}
                >
                  <Icon className="hidden sm:block" />
                  {value === 'enhance' ? 'Enhance' : SECTION_LABELS[value]}
                  {value === 'history' && read(history).length > 0 ? <span className="text-muted-foreground text-xs tabular-nums">{read(history).length}</span> : null}
                </Button>
              ))}
            </nav>
          </div>
        </header>
        <main className="panel-section" data-section={current.value}>
        <Suspense fallback={null}>
          {current.value === 'history' ? (
            <HistorySection />
          ) : current.value === 'models' ? (
            <ModelsSection />
          ) : current.value === 'rules' ? (
            <RulesSection />
          ) : current.value === 'privacy' ? (
            <SettingsSection />
          ) : (
            <EnhanceSection refresh={refresh} />
          )}
        </Suspense>
        </main>
        <Footer onSettings={() => { openSection('privacy'); window.scrollTo({ top: 0, behavior: 'instant' }) }} />
      </div>
      <Notices />
    </TooltipProvider>
  )
}

async function start(): Promise<void> {
  onPersistenceError(() => {
    panelDiagnostics.record('panel.persistence', 'failed')
    set(notice, { tone: 'danger', text: 'Changes could not be saved. Check the canvas connection and try again.' })
  })
  // In a plain browser (npm run dev) there is no Copilot: a mock stands in, with sample data.
  if (import.meta.env.DEV) {
    await (await import('./mock-host')).installMockHost()
    // ?tab=models: open a section directly (screenshots).
    const section = new URLSearchParams(location.search).get('tab')
    if (section) set(tab, section)
  } else connectCanvas()
  await ready()
  if (import.meta.env.DEV) {
    const theme = new URLSearchParams(location.search).get('theme')
    if (theme === 'light' || theme === 'dark') set(colorTheme, theme)
  }
  const stopTheme = followTheme(matchMedia('(prefers-color-scheme: dark)'), document.documentElement)
  window.addEventListener('pagehide', stopTheme, { once: true })
  // Closing or reloading the panel ends its run: the worker stops the model too.
  window.addEventListener('pagehide', closePanel)
  wirePanel()
  panelDiagnostics.record('panel.start', 'ok')
  if (import.meta.env.DEV) {
    // A browser hears no Copilot events: reload the terminal list now and then instead.
    setInterval(() => void refreshTargets(), 8000)
    // ?demo=<prompt>: types it and runs Enhance (listing pictures, on the sample data); ?options=1 opens the options.
    const query = new URLSearchParams(location.search)
    const demo = query.get('demo')
    if (query.get('options') === '1') set(optionsOpen, true)
    // ?entry=h1: a history entry read in place; ?toast=undo: a notice with its button (pictures).
    const entry = query.get('entry')
    if (entry) set(historyOpen, entry)
    if (query.get('toast') === 'undo') {
      setTimeout(() => set(notice, { tone: 'neutral', text: 'Removed from the history.', action: { label: 'Undo', run: { kind: 'history.restore', id: 'none' } } }), 600)
    }
    // ?toast=blocked: what Send says for an agent that is waiting for an answer, once the demo's result is there.
    if (query.get('toast') === 'blocked') {
      const text = say(msg('error.agent_blocked', { name: 'Claude Code' }))
      setTimeout(() => set(notice, { tone: 'warning', text, action: { label: 'Type it without Enter', run: { kind: 'send.anyway', terminalId: 'none', text: '' } } }), 6000)
    }
    // ?onestep=1: "Send right after enhancing" is on, so its button is drawn next to Enhance;
    // ?onestep=run: the demo prompt also goes through it (enhanced, then sent or held back);
    // ?onestep=0 turns it back off (the pictures share one browser profile, and it is remembered).
    const oneStep = query.get('onestep')
    if (oneStep) set(sendAfterEnhance, oneStep !== '0')
    // ?whatsnew=1: as if just updated, so What's new opens.
    if (query.get('whatsnew') === '1') localStorage.setItem('enhance-prompt:seen-version', '0')
    // ?attach=1: a screenshot and a log already attached; ?run=0 types the demo prompt without running it.
    if (query.get('attach') === '1') {
      const shot = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#e7e5e4"/><rect x="6" y="6" width="52" height="6" fill="#a8a29e"/><rect x="6" y="16" width="30" height="18" fill="#d6d3d1"/></svg>')}`
      const path = 'C:/Temp/enhance-prompt-attachments/att-1/login-mobile.png'
      previews.set(path, shot)
      put(files, [
        { path, name: 'login-mobile.png', bytes: 182_000, type: 'image/png' },
        { path: 'C:/Temp/enhance-prompt-attachments/att-2/console.log', name: 'console.log', bytes: 4_200, type: 'text/plain' }
      ])
    }
    if (demo) {
      put(draft, demo)
      // Run once the panel is idle (opening the options gathers the context first).
      const go = (): void => void (read(busy) ? setTimeout(go, 200) : oneStep === 'run' ? enhanceAndSend() : enhanceNow())
      if (query.get('run') !== '0') setTimeout(go, 300)
    }
    // The drawn content's height, in the title: scripts/make-listing.mjs crops its shots with it.
    // With the options open, also where they are (left,top,right,bottom): a picture of them alone.
    setInterval(() => {
      const page = document.querySelector('#root > div')
      if (!page) return
      const bottom = Math.max(0, ...Array.from(page.children).map((child) => child.getBoundingClientRect().bottom))
      const options = read(optionsOpen) ? document.getElementById('prompt-options')?.getBoundingClientRect() : undefined
      const where = options ? ` options:${[options.left, options.top, options.right, options.bottom].map(Math.round).join(',')}` : ''
      document.title = `height:${Math.ceil(bottom + 12)}${where}`
    }, 250)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void start().catch(error => {
  panelDiagnostics.record('panel.start', 'failed', diagnosticError(error))
  createRoot(document.getElementById('root')!).render(
    <div className="p-6"><h1>{BRAND}</h1><p role="alert">{'The canvas could not connect. Close it and open Enhance Prompt again from Copilot.'}</p><LogsButton /></div>
  )
})
