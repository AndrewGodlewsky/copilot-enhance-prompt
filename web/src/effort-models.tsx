import { read } from '#panel'
import { EFFORTS, EFFORT_LABELS, EFFORT_SETTINGS, REASONING_SETTINGS } from '../../src/effort.ts'
import { effortModels, effortReasoning, busy } from '../../src/panel/state.ts'
import { setSetting, applyRecommendedEfforts } from '../../src/panel/actions.ts'
import { effortModelOptions } from '../../src/panel/view.ts'
import { effortProblem, reasoningOptions } from '../../src/panel/copilot-status.ts'
import { Group, Row, Pick } from './common'
import { Button } from '@/components/ui/button'

export function EffortModels() {
  const working = read(busy) !== null
  return <Group title="Effort models">
    <Row><p className="text-muted-foreground text-xs leading-relaxed">Choose a Copilot model and reasoning level for each effort. Select models directly from your account; no profile setup is needed. Context Level controls project information separately.</p></Row>
    {EFFORTS.map(effort => {
      const problem = effortProblem(effort)
      return <Row key={effort} title={`${EFFORT_LABELS[effort]} effort`}>
      <div className="grid w-full gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-xs">Model<Pick disabled={working} label={`${EFFORT_LABELS[effort]} effort model`} value={read(effortModels)[effort]} options={effortModelOptions(effort)} onChange={value => void setSetting(EFFORT_SETTINGS[effort], value)} /></label>
          <label className="grid min-w-0 gap-1 text-xs">Reasoning<Pick disabled={working} label={`${EFFORT_LABELS[effort]} reasoning`} value={read(effortReasoning)[effort]} options={reasoningOptions(effort)} onChange={value => void setSetting(REASONING_SETTINGS[effort], value)} /></label>
        </div>
        {problem ? <p className="text-warning-foreground text-xs" role="status">{problem}</p> : null}
      </div>
    </Row>})}
    <Row>
      <p className="text-muted-foreground text-xs leading-relaxed">Recommended: Low uses Claude Haiku 5.5 at its highest supported reasoning; Medium uses GPT-6.1 Sol at High; High uses Claude Opus 5.5 at Medium. Availability depends on your Copilot account. Existing assignments are kept until you change them.</p>
      <Button size="sm" variant="outline" className="self-start" disabled={working} onClick={() => void applyRecommendedEfforts()}>Use recommended presets</Button>
    </Row>
    <Row><p className="text-muted-foreground text-xs leading-relaxed">Only reasoning levels supported by the model are offered. A saved unsupported choice stays visible until you replace it; it never silently changes to another level. Advanced options below manage fallbacks, tests and a separate AI-assisted context model.</p></Row>
  </Group>
}
