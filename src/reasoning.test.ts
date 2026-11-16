import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveEffort, resolveReasoning } from './effort.ts'
import type { Catalog } from './catalog.ts'

const catalog: Catalog = { source: 'GitHub Copilot', fetchedAt: 1, models: [
  { id: 'haiku-exact', label: 'Claude Haiku 5.5', supportedReasoningEfforts: ['high', 'low', 'max', 'medium'] },
  { id: 'sol-exact', label: 'GPT-6.1 Sol', supportedReasoningEfforts: ['medium', 'high'] },
  { id: 'opus-exact', label: 'Claude Opus 5.5', supportedReasoningEfforts: ['low', 'medium', 'high'] }
] }
const custom = { id: 'custom', name: 'My model', preset: 'copilot' as const, provider: 'copilot' as const, enabled: true, model: 'sol-exact' }

test('recommended tiers resolve exact advertised models and reasoning, including unordered highest levels', () => {
  for (const [effort, model, reasoning] of [['low', 'haiku-exact', 'max'], ['medium', 'sol-exact', 'high'], ['high', 'opus-exact', 'medium']] as const) {
    const resolved = resolveEffort(effort, 'recommended', 'default', [], catalog)
    assert.equal(resolved.profile.model, model)
    assert.equal(resolved.reasoningEffort, reasoning)
  }
})

test('custom and Auto assignments preserve their models and default reasoning', () => {
  for (const assignment of ['auto', 'custom|__profile_default__', 'custom|sol-exact']) {
    const result = resolveEffort('low', assignment, 'default', [custom], catalog)
    assert.equal(result.profile.model, 'sol-exact')
    assert.equal(result.reasoningEffort, undefined)
  }
  assert.equal(resolveEffort('high', 'custom|sol-exact', 'high', [custom], catalog).reasoningEffort, 'high')
  assert.equal(custom.model, 'sol-exact')
})

test('direct Copilot choices need no saved profile but require current catalog access', () => {
  const resolved = resolveEffort('medium', 'catalog:sol-exact', 'high', [], catalog)
  assert.equal(resolved.profile.provider, 'copilot')
  assert.equal(resolved.profile.model, 'sol-exact')
  assert.equal(resolved.reasoningEffort, 'high')
  assert.throws(() => resolveEffort('medium', 'catalog:sol-exact', 'default', []))
  assert.throws(() => resolveEffort('medium', 'catalog:missing', 'default', [], catalog))
  assert.throws(() => resolveEffort('medium', 'catalog:sol-exact', 'max', [], catalog))
  assert.throws(() => resolveEffort('medium', 'catalog:sol-exact', 'default', [], { ...catalog, error: 'Access failed' }))
  assert.throws(() => resolveEffort('medium', 'external|sol-exact', 'default', [], catalog), 'retired references must not become direct choices')
  assert.equal(resolveEffort('medium', 'catalog:legacy|sol-exact', 'default', [{ ...custom, id: 'catalog:legacy' }], catalog).profile.id, 'catalog:legacy')
})

test('missing, ambiguous, disabled and unsupported recommendations fail closed', () => {
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: catalog.models.slice(1) }))
  assert.throws(() => resolveEffort('low', 'recommended', 'default', [], { ...catalog, models: [...catalog.models, { ...catalog.models[0], id: 'duplicate' }] }))
  assert.throws(() => resolveEffort('medium', 'missing|sol-exact', 'high', [custom], catalog))
  assert.throws(() => resolveEffort('medium', 'auto', 'high', [{ ...custom, enabled: false }], catalog))
  assert.throws(() => resolveEffort('medium', 'recommended', 'default', [], { ...catalog, models: [{ ...catalog.models[1], supportedReasoningEfforts: ['low'] }] }))
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
