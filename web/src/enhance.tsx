import { formatText } from '../../src/format.ts'
// The Enhance section of the web panel: the composer (paste, drop or attach files; Enhance starts a rewrite),
// the run's progress, the context sent, and the enhanced prompt with Send.
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { read, set, settings, update } from '#panel'
import { useWordCrew } from './use-word-crew'
import { EFFORTS, EFFORT_LABELS } from '../../src/effort.ts'
import { CopilotConnection, CopilotConnectionIndicator } from './copilot-connection'
import { copilotStatus } from '../../src/panel/copilot-status.ts'
import { CONTEXT_LEVEL_HINTS, isContextLevel } from '../../src/presets.ts'
import { contextKey } from '../../src/panel/context-preview.ts'
import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  PaperclipIcon,
  ArrowUpToLineIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  SendIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react'
import { totalPercent, stepPercent } from '../../src/progress.ts'
import {
  busy,
  contextNotes,
  contextShown,
  contextFor,
  contextLoading,
  contextError,
  copilotDetailsOpen,
  draft,
  effectiveEnter,
  effectiveEffort,
  effort,
  effectiveLevel,
  effectiveStyle,
  excluded,
  files,
  lastRun,
  level,
  optionsOpen,
  pressEnter,
  put,
  result,
  run,
  say,
  structureChoice,
  style,
  tab,
  target,
  targets,
  tick,
  workspaceChoices,
  workspaceKey,
  workspaceName,
} from '../../src/panel/state.ts'
import {
  allowed,
  openFile,
  openSection,
  cancel,
  copy,
  enhanceAndSend,
  enhanceNow,
  pickWorkspace,
  previewContext,
  refreshTargets,
  removeFile,
  savePrompt,
  send,
  sendsAfterEnhance,
  setSetting,
  toggleItem
} from '../../src/panel/actions.ts'
import {
  contextKind,
  effortModelLabel,
  itemWhy,
  levelOptions,
  modelWarning,
  targetLabel,
  runSeconds,
  seconds,
  STEP_GLYPH,
  STEP_LABELS,
  stepShare,
  stepText,
  structureOptions,
  structureValue,
  styleOptions
} from '../../src/panel/view.ts'
import { projectLabel } from '../../src/workspaces.ts'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { attachFiles, filesOf, MAX_FILES, previews, uploadingNames } from './attach'
import { Field, IconAction, megabytes, Pick } from './common'

/** Attached files: a thumbnail for images, an icon for the rest, each with its size and a remove button. */
function Attachments() {
  const list = read(files)
  const pending = uploadingNames()
  if (list.length === 0 && pending.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((file) => (
        <div key={file.path} className="bg-muted/60 group relative flex max-w-56 items-center gap-2 rounded-md border py-1 pr-10 pl-1" title={file.path}>
          {previews.get(file.path) ? (
            <img src={previews.get(file.path)} alt="" className="size-7 shrink-0 rounded object-cover" />
          ) : (
            <span className="bg-background grid size-7 shrink-0 place-items-center rounded">
              <FileTextIcon className="text-muted-foreground size-4" />
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-medium">{file.name}</span>
            <span className="text-muted-foreground block text-xs tabular-nums">{megabytes(file.bytes)}</span>
          </span>
          <button
            type="button"
            aria-label={formatText('Remove {name}', { name: file.name })}
            onClick={() => removeFile(file.path)}
            className="text-muted-foreground hover:text-foreground absolute top-1 right-1 grid size-8 place-items-center rounded-md hover:bg-accent"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ))}
      {pending.map((name) => (
        <div key={name} className="text-muted-foreground flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs">
          <Spinner className="size-3" />
          <span className="max-w-32 truncate">{name}</span>
        </div>
      ))}
    </div>
  )
}

/** The request composer and its explicit enhancement buttons. */
function Composer({ refresh, crew }: { refresh: () => void; crew: ReturnType<typeof useWordCrew> }) {
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const working = read(busy)
  const text = read(draft)
  const locked = working === 'enhance' || crew.finishing
  const attachedCount = read(files).length + uploadingNames().length

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (locked) return
    const pasted = filesOf(event.clipboardData)
    if (pasted.length === 0) return
    event.preventDefault()
    void attachFiles(pasted, refresh)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!locked) void attachFiles(filesOf(event.dataTransfer), refresh)
  }

  return (
    <div
      className={cn('bg-card relative flex flex-col gap-3 rounded-xl border p-4 focus-within:border-ring', dragging && 'border-primary bg-primary/5')}
      onDragOver={(event) => {
        if (!locked && Array.from(event.dataTransfer.types).includes('Files')) {
          event.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <h2 className="text-base font-semibold">{'Write a request'}</h2>
      <Attachments />
      <div className="relative overflow-hidden rounded-md">
        <Textarea
          ref={crew.input}
          aria-label="Your prompt"
          aria-describedby="composer-help"
          aria-busy={locked}
          readOnly={locked}
          placeholder="Describe what you want the agent to do…"
          value={text}
          rows={3}
          onChange={(event) => { if (!locked) put(draft, event.target.value) }}
          onPaste={onPaste}
          style={crew.visible ? { color: 'transparent', caretColor: 'transparent', pointerEvents: 'none' } : undefined}
          className="max-h-80 min-h-28 resize-y bg-background pt-5 shadow-none dark:bg-background"
        />
        <svg ref={crew.scene} aria-hidden="true" focusable="false" className="pointer-events-none absolute overflow-hidden text-foreground" style={{ visibility: crew.visible ? 'visible' : 'hidden' }} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p id="composer-help" className="text-muted-foreground text-xs">{locked ? crew.finishing ? 'Prompt ready. Restoring your original request…' : 'Enhancing… Your original request is kept unchanged.' : 'Click Enhance to rewrite in English. Enter adds a new line.'}</p>
        {crew.visible && !crew.retiring ? <Button size="sm" variant="ghost" onClick={crew.togglePause} aria-pressed={crew.paused}>{crew.paused ? 'Resume animation' : 'Pause animation'}</Button> : null}
      </div>
      {dragging ? (
        <div className="border-primary text-primary pointer-events-none absolute inset-1 grid place-items-center rounded-lg border-2 border-dashed text-sm font-medium">
          {'Drop files to attach'}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-3">
        <Field label="Context Level">
          <Pick label="Context Level" value={read(effectiveLevel)} options={levelOptions(read(effectiveLevel))} onChange={(value) => set(level, value)} />
        </Field>
        <Field label="Style">
          <Pick label="Style" value={read(effectiveStyle)} options={styleOptions()} onChange={(value) => set(style, value)} />
        </Field>
        <Field label="Effort">
          <Pick label="Effort" value={read(effectiveEffort)} options={EFFORTS.map(value => ({ value, label: EFFORT_LABELS[value] }))} onChange={(value) => set(effort, value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground break-words">Model: {effortModelLabel(read(effectiveEffort))}</span>
          <CopilotConnectionIndicator />
        </div>
        <Button size="sm" variant="ghost" onClick={() => openSection('models')}>Effort settings</Button>
        <Button size="sm" variant="outline" aria-expanded={read(optionsOpen)} aria-controls={read(optionsOpen) ? 'prompt-options' : undefined} onClick={() => update(optionsOpen, (open) => !open)}>
          <SlidersHorizontalIcon />
          {'Options'}
        </Button>
      </div>
      {read(copilotDetailsOpen) || copilotStatus().kind === 'error' ? <div id="copilot-connection-details"><CopilotConnection onCheck={() => set(copilotDetailsOpen, true)} /></div> : null}
      <p className="text-muted-foreground text-xs">{CONTEXT_LEVEL_HINTS[isContextLevel(read(effectiveLevel)) ? read(effectiveLevel) as keyof typeof CONTEXT_LEVEL_HINTS : 'standard']}</p>
      {read(effectiveStyle) === 'custom' ? <CustomInstructions /> : null}
      <PromptOptions />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              void attachFiles(Array.from(event.target.files ?? []), refresh)
              event.target.value = ''
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => picker.current?.click()} disabled={locked || attachedCount >= MAX_FILES}>
            <PaperclipIcon />
            {'Attach files'}
          </Button>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {working === 'enhance' ? (
            <Button size="sm" variant="outline" onClick={cancel}>
              <SquareIcon />
              {'Cancel'}
            </Button>
          ) : (
            <>
              {/* "Send right after enhancing" is on: the one-step button sits next to Enhance, which still stops at the result. */}
              {sendsAfterEnhance() ? (
                <Button size="sm" title={'Enhance and send without reviewing'} variant="outline" onClick={() => void enhanceAndSend()} disabled={locked || !text.trim() || working !== null || !read(target)}>
                  <SendIcon />
                  {'Enhance and send'}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => void enhanceNow()} disabled={locked || !text.trim() || working !== null}>
                {'Enhance'}
              </Button>
            </>
          )}
        </div>
      </div>
      {!text.trim() && !locked && working === null ? <p className="text-muted-foreground text-xs">Enter a request to enable Enhance.</p> : null}
      {sendsAfterEnhance() ? <p className="text-muted-foreground text-xs">{'Enhance and send skips review. Enhance lets you edit first.'}</p> : null}
    </div>
  )
}

/**
 * The "Custom only" style's instructions (the `customInstructions` setting, also in Copilot's Settings):
 * the prompt follows them instead of a built-in shape. Saved when the box loses focus.
 */
function CustomInstructions() {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    void settings.get('customInstructions').then((value) => setText(typeof value === 'string' ? value : ''))
  }, [])
  if (text === null) return null
  return (
    <Field label={'Custom instructions'}>
      <Textarea
        rows={3}
        value={text}
        placeholder={'e.g. Write the prompt as a numbered checklist; always ask the agent to run the tests.'}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void setSetting('customInstructions', text.slice(0, 4000))}
        className="bg-background"
      />
      <p className="text-muted-foreground text-xs">Saved instructions apply to every style. Custom only also uses them for the format; when blank, it uses General. Shared accuracy and English-output rules still apply.</p>
    </Field>
  )
}

/** Structure and context preview, under the composer when opened. */
function PromptOptions() {
  if (!read(optionsOpen)) return null
  return (
    <div id="prompt-options" className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-3">
      <Field label={'Structure'}>
        <Pick label={'Structure'} value={structureValue()} options={structureOptions()} onChange={(value) => set(structureChoice, value === 'style' ? '' : value)} />
      </Field>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{'Context to include'}</h3>
          <Button size="sm" variant="ghost" disabled={read(contextLoading) || read(busy) !== null} onClick={() => void previewContext()}><RotateCcwIcon className="size-3.5" />Refresh context</Button>
        </div>
        <p className="text-muted-foreground text-xs">{'Uncheck files to leave them out of automatic context, including Git diffs and AI selection. Refresh after editing project files.'}</p>
      </div>
      <ContextList />
    </div>
  )
}

/** Live progress of the current run, then how it ended when it did not end well. */
function RunCard({ finishing = false }: { finishing?: boolean }) {
  const current = read(run)
  if (!current || (current.status === 'done' && !finishing)) return null
  const running = current.status === 'running'
  if (current.workspace && current.workspace.key !== read(workspaceKey)) {
    if (!running) return null
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner />
        <span className="truncate">{formatText('Writing the prompt for {name}…', { name: current.workspace.name ?? '?' })}</span>
      </div>
    )
  }
  const steps = current.steps
  const now = read(tick)
  const total = running ? totalPercent(steps, now) : (current.endPercent ?? totalPercent(steps, now))
  const active = steps.find((entry) => entry.status === 'running')
  const finished = steps.filter((entry) => entry.status === 'done' || entry.status === 'skipped')
  const next = steps.find((entry) => entry.status === 'pending')
  const idle = finished.length === 0 ? 'Starting…' : next ? stepText(next) : 'Finishing…'
  const title = current.status === 'done' ? 'Prompt ready' : running ? (active ? stepText(active) : idle) : current.status === 'cancelled' ? 'Cancelled' : 'Enhance failed'
  const failed = current.status === 'error'
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border p-3', failed && 'border-destructive/40')}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          {running ? <Spinner className="text-primary" /> : null}
          <span className="tabular-nums">{total}%</span>
          <span className={cn('truncate', failed && 'text-destructive')}>{title}</span>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{runSeconds(current, now)}</span>
      </div>
      <Progress value={total} aria-label={formatText('Progress: {percent}%', { percent: total })} className="h-1.5" />
      {steps.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {steps.map((entry) => {
            const isRunning = entry.status === 'running'
            return (
              <li key={entry.key} className="flex flex-col gap-0.5">
                <div
                  className={cn(
                    'flex justify-between gap-2',
                    (entry.status === 'pending' || entry.status === 'skipped') && 'text-muted-foreground',
                    isRunning && 'text-primary',
                    entry.status === 'failed' && 'text-destructive'
                  )}
                >
                  <span className="truncate">{`${STEP_GLYPH[entry.status]}  ${stepText(entry)}`}</span>
                  <span className="tabular-nums">{stepShare(entry, now)}</span>
                </div>
                {isRunning ? <Progress value={stepPercent(entry, now) ?? 0} aria-label={STEP_LABELS[entry.key]} className="h-1" /> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {failed && current.error ? <p className="text-destructive text-xs">{current.error}</p> : null}
      {running || current.status === 'done' ? null : (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => void enhanceNow()}>
            <RotateCcwIcon />
            {'Try again'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set(run, null)}>
            {'Dismiss'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * The context sent with the prompt, listed in the options. Opening them gathers it once (no model
 * call); untick an item to leave it out.
 */
function ContextList() {
  const shown = read(contextShown)
  const notes = read(contextNotes)
  const ex = new Set(read(excluded))
  if (read(contextLoading) || read(contextFor) !== contextKey()) {
    return (
      <div role="status" className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
        <Spinner className="size-3.5" />
        {read(busy) ? 'Context updates when enhancement finishes.' : 'Gathering context…'}
      </div>
    )
  }
  if (read(contextError)) return <p role="alert" className="text-destructive text-xs">{read(contextError)} Use Refresh context to try again.</p>
  if (shown.length === 0 && notes.length === 0) return <p className="text-muted-foreground text-xs">No automatic project context for this request.</p>
  return (
    <div className="bg-background flex max-h-72 flex-col gap-3 overflow-y-auto rounded-md border p-3">
      {shown.map((item) => (
        <div key={item.id} className="flex items-start gap-1">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
            <Checkbox checked={!ex.has(item.id)} onCheckedChange={(checked) => toggleItem(item.id, checked === true)} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{item.title ? say(item.title) : item.label}</span>
              <span className="text-muted-foreground block text-xs">
                {formatText('{kind} · {chars} chars', { kind: contextKind(item.kind), chars: item.chars.toLocaleString('en-US') })}
                {itemWhy(item)}
              </span>
            </span>
          </label>
          {/* Outside the label: a press here must not tick or untick the item. */}
          {item.id.startsWith('file:') && allowed('allowOpenFiles') ? (
            <IconAction label={'Open in Copilot'} className="shrink-0" onClick={() => void openFile(item.id.slice('file:'.length))}>
              <ExternalLinkIcon />
            </IconAction>
          ) : null}
        </div>
      ))}
      {notes.map((note) => (
        <p key={JSON.stringify(note)} className="text-muted-foreground text-xs">
          {say(note)}
        </p>
      ))}
    </div>
  )
}

/** The terminal to send to; the list reloads each time it opens (and on Copilot's workspace events). */
function TargetPicker() {
  const list = read(targets)
  return (
    <Field label={'Send to'}>
      <Pick
        label={'Send to'}
        value={read(target) ?? undefined}
        placeholder={list.length === 0 ? 'Copilot session unavailable' : 'Attached Copilot session'}
        options={list.map((item) => ({ value: item.terminalId, label: targetLabel(item) }))}
        onChange={(value) => set(target, value)}
        onOpen={() => void refreshTargets()}
      />
    </Field>
  )
}

function ResultCard({ output }: { output: string }) {
  const working = read(busy)
  const info = read(lastRun)
  const failed = info?.attempts.filter((attempt) => !attempt.ok) ?? []
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{'Review and send'}</h2>
          {info ? <Badge variant="success-light">{`${'Done'} · ${seconds(info.ms)}`}</Badge> : null}
      </div>
      <p id="result-help" className="text-muted-foreground text-xs">{'Edit the enhanced prompt below, then copy it or send it to Copilot.'}</p>
      {info ? <p className="text-muted-foreground text-xs">Used {info.model} · {info.attempts.find(attempt => attempt.ok)?.reasoningEffort ?? 'model default'} reasoning</p> : null}
      <Textarea
        aria-label={'Enhanced prompt'}
        aria-describedby="result-help"
        value={output}
        rows={10}
        onChange={(event) => put(result, event.target.value)}
        onKeyDown={(event) => {
          // Ctrl+Enter (⌘ on a Mac) sends what is in the box, edits included.
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void send(output)
          }
        }}
        className="max-h-[60vh] min-h-48 text-sm leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => void copy(output)}><CopyIcon />{'Copy'}</Button>
        <div className="flex gap-1">
          <IconAction label={'Save as a file'} onClick={() => void savePrompt(output)}><DownloadIcon /></IconAction>
          <IconAction label={'Refine: use the enhanced prompt as the new input'} onClick={() => { put(draft, output); put(result, '') }}><ArrowUpToLineIcon /></IconAction>
          <IconAction label={'Clear'} onClick={() => put(result, '')}><Trash2Icon /></IconAction>
        </div>
      </div>
      {failed.length > 0 ? (
        <p className="text-warning-foreground text-xs">
          {formatText('Fell back after: {list}', {
            list: failed.map((attempt) => `${attempt.name} (${attempt.errorText ? say(attempt.errorText) : (attempt.error ?? 'failed')})`).join(', ')
          })}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 border-t pt-3">
        <TargetPicker />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="self-end" size="sm" onClick={() => void send(output)} disabled={!allowed('allowTerminalSend') || !read(target) || working !== null}>
              <SendIcon />
              {'Send to Copilot'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{'Send to Copilot (Ctrl+Enter)'}</TooltipContent>
        </Tooltip>
        {!allowed('allowTerminalSend') ? <p className="text-muted-foreground text-xs">{'Send to Copilot is off in Settings. You can still copy or save this prompt.'}</p> : !read(target) ? <p className="text-muted-foreground text-xs">{'Copilot session unavailable. You can still copy or save this prompt.'}</p> : working !== null ? <p className="text-muted-foreground text-xs">{'Wait for the current operation to finish before sending.'}</p> : null}
      </div>
    </div>
  )
}

/**
 * Several workspaces share this one's name and branch: the person picks its folder once. Shown above
 * the composer, and in the Rules section (a rule is kept for one project).
 */
export function WorkspacePicker() {
  const choices = read(workspaceChoices)
  if (choices.length === 0) return null
  return (
    <Alert variant="warning">
      <AlertTitle>{'Which folder is this project?'}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{formatText('Several projects are named {name} on the same branch. Pick its folder so its files are read and its rules are followed.', { name: read(workspaceName) ?? '?' })}</span>
        <Pick
          label={'Project folder'}
          value={undefined}
          placeholder={'Choose a folder'}
          options={choices.map((choice) => ({ value: choice.id, label: projectLabel(choice) }))}
          onChange={(value) => void pickWorkspace(value)}
        />
      </AlertDescription>
    </Alert>
  )
}

export function EnhanceSection({ refresh }: { refresh: () => void }) {
  const current = read(run)
  const percent = current?.status === 'running' ? totalPercent(current.steps, read(tick)) : 0
  const crew = useWordCrew(current, read(draft), read(workspaceKey), percent)
  const output = read(result)
  const warning = modelWarning()
  return (
    <div className="flex flex-col gap-3">
      <WorkspacePicker />
      <Composer refresh={refresh} crew={crew} />
      <RunCard finishing={crew.finishing} />
      {output ? <ResultCard output={output} /> : null}
      {warning ? (
        <Alert variant="warning">
          <AlertTitle>{'No Copilot model yet'}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span className="flex items-center justify-between gap-2">
              <span>{'Select a Copilot model in the Models tab.'}</span>
              <Button size="sm" variant="outline" onClick={() => set(tab, 'models')}>
                {'Open Models'}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
