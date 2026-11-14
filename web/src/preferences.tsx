import { useEffect, useState } from 'react'
import { settings, type JsonValue } from '#panel'
import { t } from '../../src/i18n.ts'
import { styleOptions, levelOptions } from '../../src/panel/view.ts'
import { setSetting } from '../../src/panel/actions.ts'
import { Group, Row, Pick } from './common'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export function Preferences() {
  const [values, setValues] = useState<Record<string, JsonValue>>({})
  useEffect(() => {
    let alive = true
    const refresh = () => { void settings.get().then(value => { if (alive) setValues(value) }).catch(() => {}) }
    refresh()
    const subscription = settings.onDidChange(refresh)
    return () => { alive = false; subscription.dispose() }
  }, [])
  const edit = (key: string, value: JsonValue) => setValues(previous => ({ ...previous, [key]: value }))
  const save = (key: string) => { void setSetting(key, values[key]) }
  return <Group title={t('Prompt preferences')}>
    <Row title={t('Default style')}><Pick label={t('Default style')} value={String(values.defaultStyle ?? 'balanced')} options={styleOptions()} onChange={value => void setSetting('defaultStyle', value)} /></Row>
    <Row title={t('Default context level')}><Pick label={t('Default context level')} value={String(values.contextLevel ?? 'standard')} options={levelOptions()} onChange={value => void setSetting('contextLevel', value)} /></Row>
    <Row title={t('Default output language')}><Input aria-label={t('Default output language')} value={String(values.outputLanguage ?? 'auto')} onChange={event => edit('outputLanguage', event.target.value)} onBlur={() => save('outputLanguage')} /></Row>
    <Row title={t('Custom instructions')}><Textarea aria-label={t('Custom instructions')} value={String(values.customInstructions ?? '')} onChange={event => edit('customInstructions', event.target.value)} onBlur={() => save('customInstructions')} /></Row>
    <Row title={t('Additional context files')}><Textarea aria-label={t('Additional context files')} value={String(values.extraContextFiles ?? '')} onChange={event => edit('extraContextFiles', event.target.value)} onBlur={() => save('extraContextFiles')} /></Row>
    <Row title={t('Excluded paths')}><Textarea aria-label={t('Excluded paths')} value={String(values.excludePatterns ?? '')} onChange={event => edit('excludePatterns', event.target.value)} onBlur={() => save('excludePatterns')} /></Row>
    <Row title={t('Timeout per model (seconds)')}><Input type="number" min={5} max={300} aria-label={t('Timeout per model (seconds)')} value={Number(values.timeoutSeconds ?? 60)} onChange={event => edit('timeoutSeconds', Number(event.target.value))} onBlur={() => save('timeoutSeconds')} /></Row>
    <Row title={t('History limit')}><Input type="number" min={0} max={500} aria-label={t('History limit')} value={Number(values.historyLimit ?? 50)} onChange={event => edit('historyLimit', Number(event.target.value))} onBlur={() => save('historyLimit')} /></Row>
    <Row title={t('Adapt instructions to Copilot')} control={<Switch aria-label={t('Adapt instructions to Copilot')} checked={values.adaptToAgent !== false} onCheckedChange={value => void setSetting('adaptToAgent', value)} />} />
    <Row title={t('Auto-enhance appended text')}><Textarea aria-label={t('Auto-enhance appended text')} value={String(values.autoEnhanceAppend ?? '')} onChange={event => edit('autoEnhanceAppend', event.target.value)} onBlur={() => save('autoEnhanceAppend')} /></Row>
    <Row title={t('Auto-enhance minimum characters')}><Input type="number" min={1} max={10000} aria-label={t('Auto-enhance minimum characters')} value={Number(values.autoEnhanceMinLength ?? 8)} onChange={event => edit('autoEnhanceMinLength', Number(event.target.value))} onBlur={() => save('autoEnhanceMinLength')} /></Row>
    <Row title={t('Include context in auto-enhance')} control={<Switch aria-label={t('Include context in auto-enhance')} checked={values.autoEnhanceContext !== false} onCheckedChange={value => void setSetting('autoEnhanceContext', value)} />} />
  </Group>
}
