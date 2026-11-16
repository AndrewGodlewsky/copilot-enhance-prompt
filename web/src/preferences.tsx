import { useEffect, useState } from 'react'
import { settings, type JsonValue } from '#panel'
import { styleOptions, levelOptions } from '../../src/panel/view.ts'
import { setSetting } from '../../src/panel/actions.ts'
import { Group, Row, Pick } from './common'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { UpdateSettings } from './updates'

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
  return <>
  <Group title={'Prompt preferences'}>
    <Row title={'Default style'}><Pick label={'Default style'} value={String(values.defaultStyle ?? 'balanced')} options={styleOptions()} onChange={value => void setSetting('defaultStyle', value)} /></Row>
    <Row title={'Default context level'}><Pick label={'Default context level'} value={String(values.contextLevel ?? 'standard')} options={levelOptions(String(values.contextLevel ?? 'standard'))} onChange={value => void setSetting('contextLevel', value)} /></Row>
    <Row title={'Custom instructions'}><Textarea aria-label={'Custom instructions'} value={String(values.customInstructions ?? '')} onChange={event => edit('customInstructions', event.target.value)} onBlur={() => save('customInstructions')} /></Row>
    <Row title={'Additional context files'}><Textarea aria-label={'Additional context files'} value={String(values.extraContextFiles ?? '')} onChange={event => edit('extraContextFiles', event.target.value)} onBlur={() => save('extraContextFiles')} /></Row>
    <Row title={'Excluded paths'}><Textarea aria-label={'Excluded paths'} value={String(values.excludePatterns ?? '')} onChange={event => edit('excludePatterns', event.target.value)} onBlur={() => save('excludePatterns')} /></Row>
    <Row title={'Timeout per model (seconds)'}><Input type="number" min={5} max={300} aria-label={'Timeout per model (seconds)'} value={Number(values.timeoutSeconds ?? 60)} onChange={event => edit('timeoutSeconds', Number(event.target.value))} onBlur={() => save('timeoutSeconds')} /></Row>
    <Row title={'History limit'}><Input type="number" min={0} max={500} aria-label={'History limit'} value={Number(values.historyLimit ?? 50)} onChange={event => edit('historyLimit', Number(event.target.value))} onBlur={() => save('historyLimit')} /></Row>
    <Row title={'Adapt instructions to Copilot'} control={<Switch aria-label={'Adapt instructions to Copilot'} checked={values.adaptToAgent !== false} onCheckedChange={value => void setSetting('adaptToAgent', value)} />} />
  </Group>
  <UpdateSettings />
  </>
}
