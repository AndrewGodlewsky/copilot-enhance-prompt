import { formatText } from '../../src/format.ts'
// History, Models, Rules and Settings (privacy) sections of the web panel: the panel's state and
// actions (src/panel/*), drawn with shadcn/ReUI.
import { Fragment, useState } from 'react'
import { read, set, update } from '#panel'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, RotateCcwIcon, CheckIcon, CopyIcon, DownloadIcon, EllipsisVerticalIcon, ExternalLinkIcon, PencilIcon, PlugZapIcon, PlusIcon, RefreshCwIcon, Settings2Icon, Trash2Icon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { presetById, type ProfileView } from '../../src/presets.ts'
import type { HookRecord } from '../../src/protocol.ts'
import { isStyle, STYLE_LABELS } from '../../src/prompts.ts'
import { allStructures, BUILT_IN_STRUCTURES, MAX_RULES, MAX_STRUCTURES } from '../../src/rules.ts'
import {
  busy,
  catalogLoading,
  catalogs,
  consents,
  CLI_DEFAULT,
  confirmClearHistory,
  confirmWipe,
  customModel,
  CUSTOM_MODEL,
  dataSummary,
  defaults,
  detected,
  feedbackOff,
  filteredHistory,
  form,
  history,
  historyByProject,
  historyFilter,
  historyOpen,
  historyScope,
  hookLast,
  HISTORY_PAGE,
  historyShown,
  models,
  privacy,
  projectName,
  ruleDraft,
  ruleScope,
  say,
  sendAfterEnhance,
  structureDraft,
  tab,
  toModel,
  type Form
} from '../../src/panel/state.ts'
import {
  addDetected,
  addRule,
  allowed,
  addStructure,
  applyPreset,
  clearData,
  confirmSwitch,
  turnSwitchOff,
  clearHistory,
  copy,
  exportHistory,
  formCatalogInput,
  loadCatalog,
  modelAction,
  openForm,
  openIssues,
  patchForm,
  removeEntry,
  removeStructure,
  reuse,
  saveForm,
  saveRules,
  setFeedbackNotes,
  setRoles,
  setSendAfterEnhance,
  setSetting,
  switchModel,
  testProfile,
  toggleProfile
} from '../../src/panel/actions.ts'
import { AUTO_MODE_HINTS, DISCLOSURES, FEEDBACK_EVERY_DAYS, hookChoice, hookModels, KEY_LABEL, maxTokenChoices, modelOptions, newRuleLabel, PRIVACY_GROUPS, PRIVACY_ROWS, rulesConfig, rulesHere, ruleScopeLabel, SEND_AFTER_ROW, switchRow } from '../../src/panel/view.ts'
import { NEEDS_CONSENT, OTHER_AGENTS_LIMITS } from '../../src/privacy.ts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Field, Group, Hint, IconAction, Pick, Row, Section, Segmented } from './common'
import { WorkspacePicker } from './enhance'
import { UNSUPPORTED_SETTINGS } from '../../src/capabilities.ts'
import { Preferences } from './preferences'

const ago = (at: number) => {
  const minutes = Math.round((Date.now() - at) / 60_000)
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (minutes < 60) return format.format(-minutes, 'minute')
  if (minutes < 1440) return format.format(-Math.round(minutes / 60), 'hour')
  return format.format(-Math.round(minutes / 1440), 'day')
}

// ---------------------------------------------------------------- History

export function HistorySection() {
  const all = read(history)
  const list = read(filteredHistory)
  const shown = read(historyShown)
  if (all.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-foreground font-medium">{'No history yet'}</p>
        <p className="text-sm">{'Enhanced prompts show up here.'}</p>
      </div>
    )
  }
  const here = read(projectName)
  const byProject = read(historyByProject) && here !== null
  const scope = byProject ? read(historyScope) : 'all'
  const open = read(historyOpen)
  return (
    <div className="flex flex-col gap-2">
      <Input type="search" aria-label={'Search history'} placeholder={'Search history'} value={read(historyFilter)} onChange={(event) => set(historyFilter, event.target.value)} className="h-8" />
      {byProject ? (
        <Segmented
          label={'Which prompts to show'}
          value={scope}
          options={[
            { value: 'all', label: 'Every project' },
            { value: 'project', label: here }
          ]}
          onChange={(value) => set(historyScope, value === 'project' ? 'project' : 'all')}
        />
      ) : null}
      {list.length === 0 ? <p className="text-muted-foreground py-4 text-center text-sm">{'Nothing here matches.'}</p> : null}
      <div className="flex flex-col gap-1.5">
        {list.slice(0, shown).map((entry) => (
          <div key={entry.id} className="flex flex-col gap-3 rounded-lg border p-3">
            {/* Read in place: opening an entry in the Enhance tab replaces what the composer holds. */}
            <button
              type="button"
              aria-expanded={open === entry.id}
              aria-label={open === entry.id ? 'Hide the enhanced prompt' : 'Show the enhanced prompt'}
              onClick={() => set(historyOpen, open === entry.id ? null : entry.id)}
              className="flex min-h-8 min-w-0 items-start gap-2 rounded-md py-1 text-left hover:bg-accent"
            >
              <ChevronRightIcon className={cn('text-muted-foreground mt-0.5 size-3.5 shrink-0 transition-transform', open === entry.id && 'rotate-90')} />
              <span className={cn('min-w-0 text-sm font-medium', open === entry.id ? 'break-words whitespace-pre-wrap' : 'truncate')}>
                {open === entry.id ? entry.original.slice(0, 600) : entry.original.split('\n')[0].slice(0, 160)}
              </span>
            </button>
            {open === entry.id ? (
              <div className="bg-muted/50 max-h-64 overflow-y-auto rounded-md border p-3 text-sm break-words whitespace-pre-wrap">{entry.enhanced}</div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground min-w-0 text-xs break-words">
                {`${STYLE_LABELS[isStyle(entry.style) ? entry.style : 'balanced']} · ${entry.model}${entry.source === 'hook' ? ` · ${'auto'}` : ''}${entry.project && scope === 'all' ? ` · ${entry.project}` : ''} · ${ago(entry.at)}`}
              </span>
              <div className="ml-auto flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" title={'Open in Enhance tab'} onClick={() => reuse(entry)}>
                  <PencilIcon />
                  {'Reuse'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void copy(entry.enhanced)}>
                  <CopyIcon />
                  {'Copy'}
                </Button>
                <IconAction label={'Delete'} onClick={() => void removeEntry(entry.id)}>
                  <Trash2Icon />
                </IconAction>
              </div>
            </div>
          </div>
        ))}
      </div>
      {list.length > shown ? (
        <Button variant="ghost" size="sm" onClick={() => update(historyShown, (count: number) => count + HISTORY_PAGE)}>
          {'Show more'}
        </Button>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">{formatText('{shown} of {total}', { shown: Math.min(shown, list.length), total: all.length })}</span>
        <div className="flex flex-wrap items-center gap-2">
          {/* What the list shows goes into the file: the search and the project filter apply. */}
          <Button size="sm" variant="ghost" onClick={() => void exportHistory()} disabled={list.length === 0}>
            <DownloadIcon />
            {'Save as a file'}
          </Button>
          <Button
            size="sm"
            className="h-auto min-h-8 whitespace-normal py-1"
            variant={read(confirmClearHistory) ? 'destructive' : 'ghost'}
            onClick={() => (read(confirmClearHistory) ? void clearHistory() : set(confirmClearHistory, true))}
          >
            <Trash2Icon />
            {read(confirmClearHistory) ? 'Press again to clear history' : 'Clear history'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Models

function FormModelPicker({ current }: { current: Form }) {
  const catalog = read(catalogs).form
  const loading = read(catalogLoading).form === true
  const cli = current.provider === 'cli'
  const copilot = current.provider === 'copilot'
  const options = modelOptions(catalog, current.model)
  const inList = options.some((option) => option.value === current.model)
  const typing = read(customModel) || (current.model !== '' && !inList)
  const label = cli ? 'Model (optional)' : 'Model'
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        {options.length > 0 ? (
          <Pick
            label={label}
            disabled={copilot && (loading || !!catalog?.error || !catalog?.models.length)}
            placeholder={cli ? 'CLI default' : presetById(current.preset).model || 'Choose a model'}
            value={typing ? CUSTOM_MODEL : current.model || (cli ? CLI_DEFAULT : undefined)}
            options={[...(cli ? [{ value: CLI_DEFAULT, label: 'CLI default' }] : []), ...options, ...(!copilot ? [{ value: CUSTOM_MODEL, label: 'Other (type the id)…' }] : [])]}
            onChange={(value) => {
              set(customModel, value === CUSTOM_MODEL)
              if (value !== CUSTOM_MODEL) patchForm({ model: toModel(value) })
            }}
          />
        ) : copilot ? (
          <Pick label={label} placeholder={loading ? 'Loading the model list…' : 'Choose a model'} disabled value={undefined} options={[]} onChange={() => {}} />
        ) : (
          <Input className="h-8" placeholder={presetById(current.preset).model || (cli ? 'CLI default' : 'model-id')} value={current.model} onChange={(event) => patchForm({ model: event.target.value })} />
        )}
        <IconAction label={'Refresh model list'} disabled={loading} onClick={() => void loadCatalog('form', formCatalogInput(current), true)}>
          {loading ? <Spinner /> : <RefreshCwIcon />}
        </IconAction>
      </div>
      {!copilot && options.length > 0 && typing ? <Input className="h-8" aria-label={'Model id'} placeholder="model-id" value={current.model} onChange={(event) => patchForm({ model: event.target.value })} /> : null}
      <span className="text-muted-foreground text-xs">
        {loading
          ? 'Loading the model list…'
          : catalog?.error
            ? copilot ? (catalog.errorText ? say(catalog.errorText) : catalog.error) : formatText('Could not load the list ({error}). Type the model id.', { error: catalog.errorText ? say(catalog.errorText) : catalog.error })
            : catalog && catalog.models.length > 0
              ? copilot ? 'Models available through this Copilot session. Access is checked again before each rewrite.' : formatText('{count} models from {source}, refreshed daily.', { count: catalog.models.length, source: catalog.source })
              : cli
                ? 'Uses the model set in the CLI itself.'
                : copilot ? 'Refresh to check which Copilot models are available.' : 'Add the API key to list the models.'}
      </span>
    </Field>
  )
}

function ProfileForm() {
  const current = read(form)
  const view = read(models)
  if (!current || !view) return null
  const cli = current.provider === 'cli'
  const copilot = current.provider === 'copilot'
  const editing = Boolean(current.id)
  const preset = presetById(current.preset)
  const keyHint = editing ? 'Leave empty to keep the saved key' : preset.env ? formatText('Or set {env}', { env: preset.env }) : 'Not needed for local servers'
  const invalid = !current.name.trim() || (copilot ? read(catalogLoading).form === true || !!read(catalogs).form?.error || !read(catalogs).form?.models.some(model => model.id === current.model) : cli ? current.preset === 'custom-cli' && !current.command?.trim() : !(current.baseUrl.trim() || preset.baseUrl))
  return (
    <div className="border-primary/40 flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">{editing ? formatText('Edit {name}', { name: current.name }) : 'Add a model'}</p>
      <Field label={'Preset'}>
        <Pick label={'Preset'} value={current.preset} options={view.presets.map((entry) => ({ value: entry.id, label: entry.label }))} onChange={applyPreset} />
      </Field>
      <Field label={'Name'}>
        <Input className="h-8" value={current.name} onChange={(event) => patchForm({ name: event.target.value })} />
      </Field>
      {current.preset === 'custom' ? (
        <Field label={'API format'}>
          <Pick
            label={'API format'}
            value={current.provider}
            options={[
              { value: 'openai', label: 'OpenAI-compatible (/chat/completions)' },
              { value: 'anthropic', label: 'Anthropic (/v1/messages)' }
            ]}
            onChange={(value) => patchForm({ provider: value === 'anthropic' ? 'anthropic' : 'openai' })}
          />
        </Field>
      ) : null}
      {copilot ? (
        <p className="text-muted-foreground text-xs">{'Uses your GitHub Copilot account in the background. No npm install, API key or separate runtime. Copilot usage charges apply. It never falls back to another provider and is unavailable for chat auto-enhance.'}</p>
      ) : cli ? (
        <>
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            {'Uses your subscription'}
            <Hint text={'Runs the CLI already signed in on this machine, so it uses your subscription instead of an API key. Slower than an API (a few seconds per call), so it is skipped by auto-enhance.'} />
          </div>
          <Field label={'Command'}>
            <Input className="h-8" placeholder={current.preset === 'custom-cli' ? 'my-llm' : 'Found on PATH automatically; or a full path'} value={current.command ?? ''} onChange={(event) => patchForm({ command: event.target.value })} />
          </Field>
          {current.preset === 'custom-cli' ? (
            <Field label={'Arguments'}>
              <Input className="h-8" placeholder="run --quiet" value={current.args ?? ''} onChange={(event) => patchForm({ args: event.target.value })} />
            </Field>
          ) : null}
        </>
      ) : (
        <Field label={'Base URL'}>
          <Input className="h-8" placeholder={preset.baseUrl || 'https://…'} value={current.baseUrl} onChange={(event) => patchForm({ baseUrl: event.target.value })} />
        </Field>
      )}
      <FormModelPicker current={current} />
      {cli || copilot ? null : (
        <>
          <Field label={'API key'}>
            <Input className="h-8" type="password" placeholder={keyHint} value={current.apiKey} onChange={(event) => patchForm({ apiKey: event.target.value })} />
          </Field>
          <Field label={'Max tokens'}>
            <Pick
              label={'Max tokens'}
              value={String(current.maxTokens)}
              options={maxTokenChoices(current.maxTokens).map((value) => ({ value: String(value), label: formatText('{value} tokens', { value }) }))}
              onChange={(value) => patchForm({ maxTokens: Number(value) })}
            />
          </Field>
        </>
      )}
      <div className="flex gap-1.5">
        <Button size="sm" onClick={() => void saveForm()} disabled={invalid || read(busy) === 'save'}>
          <CheckIcon />
          {'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => set(form, null)}>
          {'Cancel'}
        </Button>
      </div>
    </div>
  )
}

function ProfileCard({ profile, index, count, fromEnv }: { profile: ProfileView; index: number; count: number; fromEnv: boolean }) {
  const where = profile.provider === 'copilot' ? 'GitHub Copilot · background rewrite' : profile.provider === 'cli' ? `${presetById(profile.preset).label.replace(/ \(.*\)$/, '')} CLI` : profile.effectiveBaseUrl
  const listed = modelOptions(read(catalogs)[profile.id], profile.effectiveModel)
  const options = [...(profile.provider === 'cli' ? [{ value: CLI_DEFAULT, label: 'CLI default' }] : []), ...listed]
  const testing = read(busy) === 'test'
  return (
    <div className={cn('bg-card flex flex-col gap-3 rounded-xl border p-3', !profile.enabled && 'bg-muted/40')}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-1.5 text-sm font-medium', !profile.enabled && 'text-muted-foreground')}>
            <span className="text-muted-foreground text-xs tabular-nums">{`#${index + 1}`}</span>
            <span className="truncate">{profile.name}</span>
          </div>
          <div className={cn('truncate text-xs', profile.keySource === 'none' ? 'text-warning-foreground' : 'text-muted-foreground')}>
            {`${KEY_LABEL[profile.keySource]} · ${where}`}
          </div>
        </div>
        {fromEnv ? null : <Switch checked={profile.enabled} aria-label={profile.enabled ? 'Disable' : 'Enable'} onCheckedChange={(enabled) => void toggleProfile(profile, enabled)} />}
        {fromEnv ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label={'More'}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openForm(profile)}>
                  <Settings2Icon />
                  {'Edit'}
                </DropdownMenuItem>
                {count > 1 ? (
                  <>
                    <DropdownMenuItem disabled={index === 0} onSelect={() => void modelAction({ move: profile.id, to: index - 1 })}>
                      <ArrowUpIcon />
                      {'Move up'}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === count - 1} onSelect={() => void modelAction({ move: profile.id, to: index + 1 })}>
                      <ArrowDownIcon />
                      {'Move down'}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void modelAction({ remove: profile.id })}>
                  <Trash2Icon />
                  {'Delete'}
                </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-12 shrink-0 text-xs">{'Model'}</span>
        {fromEnv ? (
          <span className="truncate text-xs">{profile.effectiveModel || 'CLI default'}</span>
        ) : (
          <Pick label={'Model'} value={profile.effectiveModel || CLI_DEFAULT} options={options} onChange={(value) => void switchModel(profile, toModel(value))} className="h-8" />
        )}
      </div>
      <Button size="sm" variant="outline" className="self-end" title={where} onClick={() => void testProfile(profile.id)} disabled={testing}>
        {testing ? <Spinner /> : <PlugZapIcon />}
        {'Test'}
      </Button>
    </div>
  )
}

export function ModelsSection() {
  const view = read(models)
  const prefs = read(defaults)
  if (!view) return <Spinner className="mx-auto my-8" />
  const available = read(detected).filter((entry) => !entry.added)
  const roleOptions = [
    { value: 'chain', label: 'Same as the chain' },
    ...view.profiles.map((profile) => ({ value: profile.id, label: `${profile.name} · ${profile.effectiveModel || 'CLI default'}` }))
  ]
  return (
    <div className="flex flex-col gap-4">
      {view.keysUnavailable ? (
        <Alert variant="warning">
          <AlertTitle>{'API keys cannot be saved on this machine'}</AlertTitle>
          <AlertDescription>{'Copilot found no key store here to keep them in. Use a key from an environment variable (the switch for it is in Settings), or a subscription CLI.'}</AlertDescription>
        </Alert>
      ) : null}
      <Section title={'Your models'} hint={'Models are tried top to bottom. Disabled models are skipped.'}>
        {view.fromEnv && view.profiles.length > 0 ? (
          <Alert>
            <AlertTitle>{'Using API keys from your environment'}</AlertTitle>
            <AlertDescription>{'Add a model below to customize; then only your saved models are used.'}</AlertDescription>
          </Alert>
        ) : null}
        {view.profiles.length === 0 && !read(form) ? (
          <div className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
            <p className="text-foreground font-medium">{'No models yet'}</p>
            <p>{'Add GitHub Copilot to rewrite with your Copilot account, or choose an external provider.'}</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          {view.profiles.map((profile, index) => (
            <ProfileCard key={profile.id} profile={profile} index={index} count={view.profiles.length} fromEnv={view.fromEnv} />
          ))}
        </div>
        {read(form) ? (
          <ProfileForm />
        ) : (
          <Button variant="outline" size="sm" className="self-start" onClick={() => openForm()}>
            <PlusIcon />
            {'Add model'}
          </Button>
        )}
      </Section>
      <Group title={'Fallback'}>
        <Row
          title={'Fallback to the next model when one fails'}
          description={'Models are tried top to bottom. Disabled models are skipped.'}
          control={
            <Switch
              aria-label={'Fallback to the next model when one fails'}
              checked={prefs.fallbackEnabled}
              onCheckedChange={(value) => {
                // On: any error falls back (a bad key or an unknown model too), with no second choice to make.
                if (value && prefs.fallbackOn !== 'any') void setSetting('fallbackOn', 'any')
                void setSetting('fallbackEnabled', value)
              }}
            />
          }
        />
      </Group>
      {view.profiles.length > 1 && !view.fromEnv ? (
        <Group title={'AI-assisted context level'}>
          <Row title={'File picker model (AI-assisted context level)'}>
            <Pick
              label={'File picker model (AI-assisted context level)'}
              value={view.selectorProfileId ?? 'chain'}
              options={roleOptions}
              onChange={(value) => void setRoles({ selectorProfileId: value === 'chain' ? null : value })}
            />
          </Row>
        </Group>
      ) : null}
      {available.length > 0 ? (
        <Group title={'Use your subscription, no API key'}>
          {available.map((entry) => (
            <Row
              key={entry.preset}
              title={entry.label.replace(/ \(.*\)$/, '')}
              description={<span className="block truncate">{entry.path}</span>}
              control={
                <Button size="sm" variant="outline" title={'Found on this machine. Uses the account the CLI is signed in with.'} onClick={() => void addDetected(entry.preset, entry.path)}>
                  <PlusIcon />
                  {'Add'}
                </Button>
              }
            />
          ))}
        </Group>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- Rules

/** Adds a rule for this project only (for every project while it is not known which project this is). */
function addProjectRule(project: string | null): void {
  set(ruleScope, project ? 'workspace' : 'all')
  addRule()
}

function RuleComposer({ project, full }: { project: string | null; full: boolean }) {
  return (
    <Row>
      <Textarea
        rows={2}
        aria-label={'New rule'}
        placeholder={'e.g. Use short sections and keep code identifiers unchanged.'}
        value={read(ruleDraft)}
        onChange={(event) => set(ruleDraft, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            addProjectRule(project)
          }
        }}
        className="min-h-12 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground min-w-0 truncate text-xs">{newRuleLabel()}</span>
        <Button size="sm" onClick={() => addProjectRule(project)} disabled={!read(ruleDraft).trim() || full}>
          <PlusIcon />
          {'Add rule'}
        </Button>
      </div>
    </Row>
  )
}

/** The structure form: a new structure, or (with an id) an edit of one, built-in ones included. */
function StructureForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const draft = read(structureDraft)
  const full = !id && rulesConfig().structures.length >= MAX_STRUCTURES
  return (
    <Row>
      <Input className="h-8" aria-label={'Structure name'} placeholder={'e.g. My brief'} value={draft.name} onChange={(event) => set(structureDraft, { ...draft, name: event.target.value })} />
      <Textarea
        rows={4}
        aria-label={'Headings, one per line'}
        placeholder={BUILT_IN_STRUCTURES[0].sections.slice(0, 4).map((section) => section).join('\n')}
        value={draft.sections}
        onChange={(event) => set(structureDraft, { ...draft, sections: event.target.value })}
      />
      <p className="text-muted-foreground text-xs">Headings, one per line · The rewritten prompt uses English headings; your saved structure stays unchanged.</p>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            addStructure(id)
            onDone()
          }}
          disabled={!draft.name.trim() || !draft.sections.trim() || full}
        >
          <CheckIcon />
          {id ? 'Save' : 'Add structure'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {'Cancel'}
        </Button>
      </div>
    </Row>
  )
}

export function RulesSection() {
  const config = rulesConfig()
  const project = read(projectName)
  const shownRules = rulesHere()
  // The structure being edited: 'new', an id, or none.
  const [editing, setEditing] = useState<string | null>(null)
  const startEditing = (value: string) => {
    if (value === 'new') set(structureDraft, { name: '', sections: '' })
    setEditing(value)
  }
  return (
    <div className="flex flex-col gap-4">
      {/* Not known which of several same-named projects this is: a new rule would be for every project. */}
      <WorkspacePicker />
      <Group
        title={'Your rules'}
        hint={'Followed in every enhanced prompt and by auto-enhance, on top of the style. A rule you add is for the project you are in.'}
      >
        {shownRules.length === 0 ? (
          <Row>
            <p className="text-muted-foreground text-sm">{'No rules yet. Example: "Always tell the agent to run pnpm test before finishing."'}</p>
          </Row>
        ) : null}
        {shownRules.map((rule) => (
          <Row
            key={rule.id}
            className={cn(!rule.enabled && 'opacity-60')}
            title={<span className="font-normal break-words">{rule.text}</span>}
            description={ruleScopeLabel(rule)}
            control={
              <div className="flex items-center gap-1">
                <Switch
                  checked={rule.enabled}
                  aria-label={rule.enabled ? 'Disable' : 'Enable'}
                  onCheckedChange={(enabled) => saveRules((current) => ({ ...current, rules: current.rules.map((entry) => (entry.id === rule.id ? { ...entry, enabled } : entry)) }))}
                />
                <IconAction label={'Delete'} onClick={() => saveRules((current) => ({ ...current, rules: current.rules.filter((entry) => entry.id !== rule.id) }))}>
                  <Trash2Icon />
                </IconAction>
              </div>
            }
          />
        ))}
        <RuleComposer project={project} full={config.rules.length >= MAX_RULES} />
      </Group>
      <Group
        title={'Prompt structures'}
        hint={"Pick one under Options in the composer: the prompt is written under these headings instead of the style's shape."}
        action={
          editing ? null : (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => startEditing('new')} disabled={config.structures.length >= MAX_STRUCTURES}>
              <PlusIcon />
              {'Add structure'}
            </Button>
          )
        }
      >
        {editing === 'new' ? <StructureForm onDone={() => setEditing(null)} /> : null}
        {allStructures(config).map(({ structure, builtIn, edited }) => {
          const name = structure.name
          const sections = structure.sections
          if (editing === structure.id) return <StructureForm key={structure.id} id={structure.id} onDone={() => setEditing(null)} />
          return (
            <Row
              key={structure.id}
              title={
                <span className="flex items-center gap-1.5">
                  {name}
                  {builtIn ? <Badge variant="outline">{edited ? 'edited' : 'built-in'}</Badge> : null}
                </span>
              }
              description={sections.join(' · ')}
              control={
                <div className="flex">
                  <IconAction
                    label={'Edit'}
                    onClick={() => {
                      set(structureDraft, { name, sections: sections.join('\n') })
                      startEditing(structure.id)
                    }}
                  >
                    <PencilIcon />
                  </IconAction>
                  {builtIn ? (
                    edited ? (
                      <IconAction label={'Restore the default'} onClick={() => removeStructure(structure.id)}>
                        <RotateCcwIcon />
                      </IconAction>
                    ) : null
                  ) : (
                    <IconAction label={'Delete'} onClick={() => removeStructure(structure.id)}>
                      <Trash2Icon />
                    </IconAction>
                  )}
                </div>
              }
            />
          )
        })}
      </Group>
    </div>
  )
}

// ---------------------------------------------------------------- Settings (privacy)

/** Choices offered for the amounts (a value set in Copilot's Settings is added when it is not one of them). */
const AGENT_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8]
const LINE_CHOICES = [10, 20, 40, 80, 120, 200, 300]
const withValue = (choices: number[], value: number) => [...new Set([...choices, value])].sort((a, b) => a - b)

/** How many other agents and lines "Read other agents' sessions" reads; saved even while it is off. */
function OtherAgentsAmounts({ active }: { active: boolean }) {
  const { agents, lines } = read(defaults).otherAgents
  return (
    <span className="mt-2 flex flex-col gap-1.5">
      <span className="grid grid-cols-2 gap-2">
        <Field label={'Agents read'}>
          <Pick
            label={'Agents read'}
            value={String(agents)}
            options={withValue(AGENT_CHOICES, agents).map((value) => ({ value: String(value), label: formatText('{count} agents', { count: value }) }))}
            onChange={(value) => void setSetting(OTHER_AGENTS_LIMITS.agents.key, Number(value))}
          />
        </Field>
        <Field label={'Lines per agent'}>
          <Pick
            label={'Lines per agent'}
            value={String(lines)}
            options={withValue(LINE_CHOICES, lines).map((value) => ({ value: String(value), label: formatText('{count} lines', { count: value }) }))}
            onChange={(value) => void setSetting(OTHER_AGENTS_LIMITS.lines.key, Number(value))}
          />
        </Field>
      </span>
      {active ? null : <span className="text-muted-foreground">{'Used only while this switch is on and confirmed.'}</span>}
    </span>
  )
}

/**
 * "Send right after enhancing": a switch of the panel's own, drawn like the Privacy switches. It
 * turns on only from its dialog, and says so when "Send to Copilot", which it needs, is off.
 */
function SendAfterRow({ onRead, onAsk }: { onRead: () => void; onAsk: () => void }) {
  const row = SEND_AFTER_ROW
  const on = read(sendAfterEnhance)
  return (
    <Row
      title={
        <span className="flex flex-wrap items-center gap-1.5">
          {row.label}
          <Badge variant="outline">{'asks to confirm'}</Badge>
        </span>
      }
      description={
        <>
          {row.hint}{' '}
          <button type="button" className="hover:text-foreground block min-h-8 rounded-md text-left underline underline-offset-2" onClick={onRead}>
            {'Risk and when to use it'}
          </button>
          {on && !allowed('allowTerminalSend') ? <span className="text-warning-foreground mt-1 block">{'It does nothing while "Send to Copilot" is off.'}</span> : null}
        </>
      }
      control={<Switch checked={on} aria-label={row.label} onCheckedChange={(value) => (value ? onAsk() : setSendAfterEnhance(false))} />}
    />
  )
}

/**
 * Everything about one switch, in plain words: what it does, what can go wrong, and when it is
 * worth turning on. Opened from a row's link to read, or (`confirm`) before a switch that needs it
 * turns on, with Turn on / Cancel.
 */
function SwitchDialog({ keyName, confirm, onClose }: { keyName: string | null; confirm: boolean; onClose: () => void }) {
  const row = switchRow(keyName)
  const points = row ? (DISCLOSURES[row.key as keyof typeof DISCLOSURES] ?? [row.hint]) : []
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex max-h-[85vh] max-w-[calc(100vw-24px)] flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle>{row ? (confirm ? formatText('Turn on "{name}"?', { name: row.label }) : row.label) : ''}</DialogTitle>
          <DialogDescription>
            {confirm ? 'Read what this allows. Nothing is hidden: this is everything it does.' : 'What this switch does, what can go wrong, and when it is worth turning on.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2.5 overflow-y-auto text-sm leading-relaxed">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">{'What it does'}</h4>
            {/* Padding, not a margin: the box scrolls, and a scrolling box cuts off bullets drawn outside it. */}
            <ul className="list-disc space-y-1.5 pl-5">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">{'What can go wrong'}</h4>
            <p>{row ? row.risk : ''}</p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">{'When to turn it on'}</h4>
            <p>{row ? row.when : ''}</p>
          </div>
        </div>
        {confirm ? <p className="text-muted-foreground text-xs">{'You can turn it off at any time here; turning it off also withdraws this confirmation.'}</p> : null}
        <div className="flex justify-end gap-1.5">
          {confirm ? (
            <>
              <Button size="sm" variant="ghost" onClick={onClose}>
                {'Cancel'}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // The panel's own switch is turned on here; a Privacy switch is confirmed with the worker.
                  if (row?.key === SEND_AFTER_ROW.key) setSendAfterEnhance(true)
                  else if (row) void confirmSwitch(row.key)
                  onClose()
                }}
              >
                {'I understand, turn it on'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onClose}>
              {'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** What auto-enhance did with the last prompt Copilot sent, in one line (a prompt left as it was says why). */
function hookLastText(last: HookRecord): string {
  const when = ago(last.at)
  const agent = last.agent ?? 'an agent'
  if (last.outcome === 'rewritten') return formatText('Last prompt ({when}): rewritten for {agent} with {model}.', { when, agent, model: last.model ?? '?' })
  if (last.outcome === 'appended') return formatText('Last prompt ({when}): your text was added for {agent}.', { when, agent })
  return formatText('Last prompt ({when}): left unchanged for {agent}. {reason}', { when, agent, reason: last.reason ? say(last.reason) : '' })
}

export function SettingsSection() {
  // ?ask=<switch> opens its confirmation at once in the dev server (pictures of the dialog).
  const [asking, setAsking] = useState<string | null>(import.meta.env.DEV ? new URLSearchParams(location.search).get('ask') : null)
  // A switch whose explanation is open to read (?details=<switch> in the dev server, for pictures).
  const [reading, setReading] = useState<string | null>(import.meta.env.DEV ? new URLSearchParams(location.search).get('details') : null)
  const last = read(hookLast)
  const flags = read(privacy)
  const data = read(dataSummary)
  const prefs = read(defaults)
  const view = read(models)
  const hookOptions = hookModels()
  return (
    <div className="flex flex-col gap-4">
      <Preferences />
      <Group title={'Auto-enhance'} hint={'Changes the text Copilot receives; the chat still shows your original message. Off by default. Ambiguous prompts are left unchanged.'}>
        <Row>
          <Segmented
            label={'Auto-enhance Copilot session prompts'}
            value={prefs.autoEnhanceMode}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'rules', label: 'Rules' },
              { value: 'ai', label: 'AI' }
            ]}
            onChange={(value) => void setSetting('autoEnhanceMode', value)}
          />
          <p className="text-muted-foreground text-xs">{AUTO_MODE_HINTS[prefs.autoEnhanceMode] ?? AUTO_MODE_HINTS.off}</p>
          {/* Auto-enhance works out of sight: what it did last, and why when it did nothing. */}
          {prefs.autoEnhanceMode !== 'off' && last ? <p className={cn('text-xs', last.outcome === 'skipped' ? 'text-warning-foreground' : 'text-muted-foreground')}>{hookLastText(last)}</p> : null}
        </Row>
        {view && prefs.autoEnhanceMode === 'ai' && hookOptions.length === 0 ? (
          <Row
            title={'Auto-enhance (AI) has no model to use'}
            description={'It needs an enabled API model. Copilot background rewriting and subscription CLIs are excluded from its two-second limit. Add an API model, or use Rules.'}
            control={
              <Button size="sm" variant="outline" onClick={() => set(tab, 'models')}>
                {'Open Models'}
              </Button>
            }
          />
        ) : null}
        {view && hookOptions.length > 1 && !view.fromEnv && prefs.autoEnhanceMode === 'ai' ? (
          <Row title={'Auto-enhance hook model (needs to answer in under 2 s)'}>
            <Pick
              label={'Auto-enhance hook model (needs to answer in under 2 s)'}
              value={hookChoice()}
              options={[{ value: 'chain', label: 'Same as the chain' }, ...hookOptions.map((profile) => ({ value: profile.id, label: `${profile.name} · ${profile.effectiveModel}` }))]}
              onChange={(value) => void setRoles({ hookProfileId: value === 'chain' ? null : value })}
            />
          </Row>
        ) : null}
      </Group>
      {PRIVACY_GROUPS.map((group, index) => (
      <Group
        key={group.id}
        title={group.title}
        hint={index === 0 ? 'These switches control what Enhance Prompt reads, sends and stores. They are checked for every run.' : undefined}
      >
        {PRIVACY_ROWS.filter((row) => row.group === group.id).map((row) => {
          const unavailable = UNSUPPORTED_SETTINGS.has(row.key)
          const needs = NEEDS_CONSENT.has(row.key)
          const on = flags[row.key] === true
          // On in Copilot's Settings but never confirmed here: the worker keeps it off until confirmed.
          const waiting = needs && on && !read(consents).includes(row.key)
          return (
            <Fragment key={row.key}>
            <Row
              title={
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.label}
                  {unavailable ? <Badge variant="outline">{'Unavailable in Copilot'}</Badge> : needs ? <Badge variant="outline">{'asks to confirm'}</Badge> : null}
                </span>
              }
              description={
                <>
                  {unavailable ? 'The current canvas SDK does not provide this capability.' : row.hint}{' '}
                  {!unavailable ? <>
                  <button type="button" className="hover:text-foreground block min-h-8 rounded-md text-left underline underline-offset-2" onClick={() => setReading(row.key)}>
                    {'Risk and when to use it'}
                  </button>
                  {row.key === 'allowOtherAgents' ? <OtherAgentsAmounts active={on && !waiting && flags.allowTerminalRead !== false} /> : null}
                  {waiting ? (
                    <span className="text-warning-foreground mt-1 flex items-center gap-2">
                      {'Turned on in Settings, but not confirmed here yet: still off.'}
                      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setAsking(row.key)}>
                        {'Read and confirm'}
                      </Button>
                    </span>
                  ) : null}
                  </> : null}
                </>
              }
              control={
                <Switch
                  disabled={unavailable}
                  checked={on && !waiting}
                  aria-label={row.label}
                  onCheckedChange={(value) => {
                    if (value && needs) {
                      setAsking(row.key)
                      return
                    }
                    update(privacy, (map: Record<string, boolean>) => ({ ...map, [row.key]: value }))
                    void (value ? setSetting(row.key, true) : turnSwitchOff(row.key))
                  }}
                />
              }
            />
            {/* Right under the switch it depends on. */}
            {row.key === 'allowTerminalSend' ? <SendAfterRow onRead={() => setReading(SEND_AFTER_ROW.key)} onAsk={() => setAsking(SEND_AFTER_ROW.key)} /> : null}
            </Fragment>
          )
        })}
      </Group>
      ))}
      <Group title={'Notifications'}>
        <Row
          title={'Notify when a long enhance finishes'}
          description={'The current canvas SDK does not provide this capability.'}
          control={<Switch disabled checked={false} aria-label={'Notify when a long enhance finishes'} />}
        />
      </Group>
      <SwitchDialog
        keyName={asking ?? reading}
        confirm={asking !== null}
        onClose={() => {
          setAsking(null)
          setReading(null)
        }}
      />
      <Group title={'Stored on this machine'} hint={'Nothing is sent anywhere except your prompt and the context you allow, to the model you run. No tracking or analytics.'}>
        {data ? (
          [
            ['History', data.history, () => void clearData('history'), 'Clear history'],
            ['Saved models', data.profiles, null, ''],
            ['API keys (protected by Windows)', data.keys, null, ''],
            ['Cached model lists', data.catalogs, () => void clearData('catalogs'), 'Clear model lists']
          ].map(([label, value, clear, clearLabel]) => (
            <Row
              key={String(label)}
              title={<span className="font-normal">{String(label)}</span>}
              control={
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm tabular-nums">{String(value)}</span>
                  {typeof clear === 'function' ? (
                    <IconAction label={String(clearLabel)} onClick={clear}>
                      <Trash2Icon />
                    </IconAction>
                  ) : null}
                </div>
              }
            />
          ))
        ) : (
          <Row>
            <Spinner />
          </Row>
        )}
        <Row
          control={
            <Button size="sm" variant={read(confirmWipe) ? 'destructive' : 'outline'} onClick={() => (read(confirmWipe) ? void clearData('all') : set(confirmWipe, true))}>
              {read(confirmWipe) ? 'Press again to delete everything' : 'Delete everything'}
            </Button>
          }
          description={'Usage records are kept separately for Usage Insights and are not removed by these controls.'}
        />
      </Group>
      <Group title={'Feedback'}>
        <Row
          description={'Found a bug, or something that could be better? Open an issue on GitHub: it is how the plugin gets fixed and improved.'}
          control={
            <IconAction label={'Open an issue on GitHub'} variant="outline" onClick={() => void openIssues()}>
              <ExternalLinkIcon />
            </IconAction>
          }
        />
        <Row
          title={'Ask for feedback now and then'}
          description={formatText('A short note under the enhanced prompt invites your ideas, at most once in {days} days. Off: it never shows.', { days: FEEDBACK_EVERY_DAYS })}
          control={<Switch checked={!read(feedbackOff)} aria-label={'Ask for feedback now and then'} onCheckedChange={setFeedbackNotes} />}
        />
      </Group>
    </div>
  )
}
