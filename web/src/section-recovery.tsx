import { Component, lazy, Suspense, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { panelDiagnostics } from '../../src/panel/diagnostics.ts'

export class SectionBoundary extends Component<{ name: string; retry(): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { panelDiagnostics.record('panel.section', 'failed', { code: 'unavailable' }) }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="rounded-lg border p-4 text-sm">
      <p role="alert">{this.props.name} could not be displayed.</p>
      <p className="my-2 text-muted-foreground">Try loading this section again. If it still fails after an update, copy any unsaved text and reopen Enhance Prompt from Copilot.</p>
      <Button variant="outline" onClick={this.props.retry}>Retry section</Button>
    </div>
  }
}

export function RecoverableSection({ name, load }: { name: string; load(): Promise<{ default: ComponentType }> }) {
  const [attempt, retry] = useState(0)
  // React.lazy caches a rejected promise. An explicit retry needs a fresh lazy wrapper.
  const Section = useMemo(() => lazy(load), [load, attempt])
  return <SectionBoundary key={attempt} name={name} retry={() => retry(value => value + 1)}>
    <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Loading {name}…</p>}><Section /></Suspense>
  </SectionBoundary>
}
