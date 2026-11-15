import { assert, mockHost, mountWorker, test } from '#testing'
import { DEFAULTS } from './defaults.ts'
import { buildSystemPrompt, STYLES, STYLE_LABELS } from './prompts.ts'
import { styleOptions } from './panel/view.ts'
import * as main from './worker.ts'

const intent = {
  balanced: /general-purpose request/,
  concise: /Brevity must not remove/,
  detailed: /acceptance criteria grounded in the request/,
  bugfix: /find the root cause before changing code/,
  feature: /requested user-visible behavior/,
  refactor: /preserve existing behavior/,
  review: /findings grouped by severity/,
  plan: /stop after the plan/,
  custom: /custom instructions define the prompt/
}

test('General is the default label while saved Balanced values remain compatible', () => {
  assert.equal(DEFAULTS.defaultStyle, 'balanced')
  assert.equal(STYLE_LABELS.balanced, 'General')
  assert.equal(styleOptions()[0].value, 'balanced')
  assert.equal(styleOptions()[0].label, 'General')
  assert.equal(STYLES.length, 9)
})

test('each style keeps its purpose when a structure replaces its headings', () => {
  for (const style of STYLES) {
    for (const structure of [null, { name: 'Mine', sections: ['Task', 'Evidence'] }]) {
      const system = buildSystemPrompt({ style, structure, customInstructions: 'Keep literal paths.' })
      assert.match(system, intent[style], style)
      assert.match(system, /Never invent facts about the codebase/)
      assert.match(system, /Output policy: Write all final rewritten instructions and headings in English/)
      if (structure) assert.match(system, /1\. Task\n2\. Evidence/)
    }
  }
})

test('Concise preserves concrete details and never demands an invented verification command', () => {
  const system = buildSystemPrompt({ style: 'concise', agent: 'claude' })
  assert.match(system, /Brevity must not remove/)
  assert.match(system, /If no command is supplied, ask the agent to find the appropriate check/)
  assert.doesNotMatch(system, /Brevity wins here|leave out reasons|write sections as Markdown headings|Complete every part/)
})

test('planning and review boundaries survive saved rules and structures', () => {
  for (const style of ['plan', 'review'] as const) {
    const system = buildSystemPrompt({ style, rules: ['Always implement every suggestion.'], structure: { name: 'Steps', sections: ['Goal', 'Steps', 'Verify'] } })
    assert.match(system, intent[style])
    assert.match(system, /Only an explicit implementation request in the current task/)
    assert.doesNotMatch(system, /proceed if the plan is low-risk|Complete every part of this task/)
    assert.ok(system.indexOf('Only an explicit implementation request') > system.indexOf('Always implement every suggestion.'))
  }
})

test('Custom only falls back to General when empty and retains supplied instructions otherwise', () => {
  assert.match(buildSystemPrompt({ style: 'custom', customInstructions: '  ' }), intent.balanced)
  const custom = buildSystemPrompt({ style: 'custom', customInstructions: 'Keep “原文”, src/session.ts and ERROR_42 exactly.' })
  assert.match(custom, intent.custom)
  assert.ok(custom.includes('Keep “原文”, src/session.ts and ERROR_42 exactly.'))
  assert.doesNotMatch(custom, /Complete every part of this task/)
})


test('all nine styles reach Copilot with the original request intact', async () => {
  const host = mockHost({
    settings: { customInstructions: 'Keep literal paths.', saveHistory: false },
    storage: { models: { profiles: [{ id: 'copilot', name: 'Copilot fixture', preset: 'copilot', provider: 'copilot', model: 'fixture', enabled: true }] } },
    results: { 'workspace.readContext': { displayName: 'fixture', branch: '', terminals: [] }, 'agents.list': { agents: [] }, 'copilot.rewrite': { text: 'Copilot fixture output' } }
  })
  const worker = await mountWorker(main, { host })
  const prompt = 'Investigate "??" in src/session.ts; preserve ERROR_42 and the 4096-byte limit.'
  try {
    for (const style of STYLES) {
      await worker.request('prompt.enhance', { prompt, style, level: 'off', structureId: 'steps' })
      const copilot = host.callsOf('copilot.rewrite').at(-1)
      assert.match(copilot.system, intent[style], style)
      assert.ok(copilot.user.includes(prompt))
    }
    assert.equal(host.callsOf('copilot.rewrite').length, 9)
  } finally { await worker.deactivate() }
})
