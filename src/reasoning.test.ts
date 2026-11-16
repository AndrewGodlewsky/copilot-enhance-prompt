import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEffort, resolveReasoning } from './effort.ts'
import { LlmError } from './llm.ts'
import type { Catalog } from './catalog.ts'

const catalog: Catalog = { source: 'GitHub Copilot', fetchedAt: 1, models: [
  { id: 'claude-haiku-5.5', label: 'Claude Haiku 5.5', supportedReasoningEfforts: ['high', 'low', 'max', 'medium'] },
  { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', supportedReasoningEfforts: ['medium', 'high'] },
  { id: 'claude-opus-5.5', label: 'Claude Opus 5.5', supportedReasoningEfforts: ['low', 'medium', 'high'] },
  { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', supportedReasoningEfforts: ['medium', 'high'] },
  { id: 'claude-sonnet-5.5', label: 'Claude Sonnet 5.5', supportedReasoningEfforts: ['low', 'medium', 'high'] }
] }
const custom = { id: 'custom', name: 'My model', preset: 'copilot' as const, provider: 'copilot' as const, enabled: true, model: 'gpt-6.1-terra' }

test('recommended tiers resolve exact advertised models and reasoning, including unordered highest levels', () => {
  for (const [effort, model, reasoning] of [['low', 'claude-haiku-5.5', 'max'], ['medium', 'gpt-6.1-sol', 'high'], ['high', 'claude-opus-5.5', 'medium']] as const) {
    const resolved = resolveEffort(effort, 'recommended', 'default', [], catalog)
    assert.equal(resolved.profile.model, model)
    assert.equal(resolved.reasoningEffort, reasoning)
  }
})

test('custom and Auto assignments preserve their models and default reasoning', () => {
  for (const assignment of ['auto', 'custom|__profile_default__', 'custom|gpt-6.1-terra']) {
    const result = resolveEffort('low', assignment, 'default', [custom], catalog)
    assert.equal(result.profile.model, 'gpt-6.1-terra')
    assert.equal(result.reasoningEffort, undefined)
  }
  assert.equal(resolveEffort('high', 'custom|gpt-6.1-terra', 'high', [custom], catalog).reasoningEffort, 'high')
  assert.equal(custom.model, 'gpt-6.1-terra')
})

test('updated recommendations preserve explicit model and reasoning choices', () => {
  for (const [effort, model, reasoning] of [['medium', 'gpt-6.1-terra', 'medium'], ['high', 'claude-sonnet-5.5', 'high'], ['medium', 'gpt-6.1-sol', 'medium'], ['high', 'claude-opus-5.5', 'high']] as const) {
    const result = resolveEffort(effort, `catalog:${model}`, reasoning, [], catalog)
    assert.equal(result.profile.model, model)
    assert.equal(result.reasoningEffort, reasoning)
  }
})

test('direct Copilot choices need no saved profile but require current catalog access', () => {
  const resolved = resolveEffort('medium', 'catalog:gpt-6.1-terra', 'high', [], catalog)
  assert.equal(resolved.profile.provider, 'copilot')
  assert.equal(resolved.profile.model, 'gpt-6.1-terra')
  assert.equal(resolved.reasoningEffort, 'high')
  assert.throws(() => resolveEffort('medium', 'catalog:gpt-6.1-terra', 'default', []))
  assert.throws(() => resolveEffort('medium', 'catalog:missing', 'default', [], catalog))
  assert.throws(() => resolveEffort('medium', 'catalog:gpt-6.1-terra', 'max', [], catalog))
  assert.throws(() => resolveEffort('medium', 'catalog:gpt-6.1-terra', 'default', [], { ...catalog, error: 'Access failed' }))
  assert.throws(() => resolveEffort('medium', 'external|gpt-6.1-terra', 'default', [], catalog), 'retired references must not become direct choices')
  assert.equal(resolveEffort('medium', 'catalog:legacy|gpt-6.1-terra', 'default', [{ ...custom, id: 'catalog:legacy' }], catalog).profile.id, 'catalog:legacy')
})

test('missing, ambiguous, disabled and unsupported recommendations fail closed', () => {
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: catalog.models.slice(1) }))
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: [...catalog.models, { ...catalog.models[0], id: 'duplicate' }] }))
  assert.throws(() => resolveEffort('medium', 'missing|gpt-6.1-terra', 'high', [custom], catalog))
  assert.throws(() => resolveEffort('medium', 'auto', 'high', [{ ...custom, enabled: false }], catalog))
  assert.throws(() => resolveEffort('medium', 'recommended', 'default', [], { ...catalog, models: [{ ...catalog.models[1], supportedReasoningEfforts: ['low'] }] }))
})

test('unavailable recommendations are distinguished from ambiguous catalog matches', () => {
  const failure = (code: string) => (error: unknown) => error instanceof LlmError && error.text.code === code
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: [] }), failure('error.copilot_recommended_missing'))
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: [...catalog.models, { ...catalog.models[0], id: 'duplicate' }] }), failure('error.copilot_recommended'))
})

test('reasoning accepts only supported values and never assumes the order of unknown levels', () => {
  assert.equal(resolveReasoning({ id: 'literal', label: 'Literal', supportedReasoningEfforts: ['highest'] }, 'highest'), 'highest')
  assert.equal(resolveReasoning(catalog.models[0], 'highest'), 'max')
  assert.throws(() => resolveReasoning(catalog.models[1], 'max'))
  assert.throws(() => resolveReasoning({ id: 'opaque', label: 'Opaque', supportedReasoningEfforts: ['deep', 'shallow'] }, 'highest'))
  assert.equal(resolveReasoning({ id: 'opaque', label: 'Opaque', supportedReasoningEfforts: ['deep'] }, 'deep'), 'deep')
  assert.equal(resolveReasoning({ id: 'fixed', label: 'Fixed' }, 'default'), undefined)
  assert.throws(() => resolveReasoning({ id: 'fixed', label: 'Fixed' }, 'high'))
})
