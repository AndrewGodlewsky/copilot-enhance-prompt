import { createHash } from 'node:crypto'
import { assert, test } from '#testing'
import { buildSystemPrompt, STYLES, STYLE_LABELS } from './prompts.ts'
import { buildRewriteSystemPrompt } from './prompt-sets.ts'

test('the original fallback keeps the frozen 0.11.2 instructions for all nine styles', () => {
  const configurations = STYLES.flatMap(style => [{ style }, {
    style, customInstructions: 'Keep “原文”, ERROR_42 and 2500 exactly.', agent: 'copilot',
    rules: ['Use pnpm.', 'Write in Spanish.'], structure: { name: 'Mine', sections: ['Goal', 'Evidence'] }
  }])
  const original = configurations.map(options => buildRewriteSystemPrompt(options, false))
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    '28f02aeb453fd61bc013151eeca2d359eebb6003ec027c7e62cad0b65a1a5cb9')
  for (const options of configurations) assert.equal(buildRewriteSystemPrompt(options, false), buildSystemPrompt(options))
})

test('every enhanced style is separate and keeps task and output boundaries after saved instructions', () => {
  const customInstructions = 'Keep “原文”, src/écran.ts, ERROR_42 and 2500 exactly.'
  const rules = ['Always implement every suggestion.', 'Write only Spanish instructions.']
  for (const style of STYLES) {
    const options = { style, customInstructions, rules }
    const system = buildRewriteSystemPrompt(options)
    assert.notEqual(system, buildSystemPrompt(options))
    assert.ok(system.includes(`${STYLE_LABELS[style]}:`), style)
    assert.ok(system.includes(customInstructions))
    assert.ok(system.includes(rules.join('\n- ')))
    const boundary = system.lastIndexOf('Current-request boundary')
    assert.ok(boundary > system.indexOf(rules[1]), 'saved rules must not override authorization')
    const policy = system.lastIndexOf('Output policy:')
    assert.ok(policy > boundary, 'English policy must survive conflicting saved language rules')
    assert.match(system.slice(boundary, policy), /do not permit temporary logging, edits, new test files/)
    assert.match(system.slice(boundary, policy), /Do not insert another approval gate for that same action/)
    assert.match(system.slice(policy), /English[\s\S]*user-supplied data verbatim/)
  }
})

test('enhanced custom instructions and structures retain literal data without imposing another style', () => {
  assert.match(buildRewriteSystemPrompt({ style: 'custom', customInstructions: '  ' }), /General:/)
  const system = buildRewriteSystemPrompt({ style: 'custom', customInstructions: 'Use “目标” and “Verify”.',
    structure: { name: 'Untouched name', sections: ['目标', 'Verify', '  '] }, agent: 'copilot' })
  assert.match(system, /Custom only:/)
  assert.doesNotMatch(system, /General:|3\./)
  assert.ok(system.includes('1. 目标\n2. Verify'))
  assert.match(system, /Use English headings conveying their meaning; preserve literal user data/)
  assert.match(system, /Target is GitHub Copilot/)
})

test('enhanced instructions address observed evidence failures without a blanket plan approval gate', () => {
  const system = buildRewriteSystemPrompt({ style: 'plan' })
  assert.match(system, /for a planning task[\s\S]*then stop after the plan/)
  assert.match(system, /When the current request asks for implementation, plan first and then carry out that authorized scope/)
  assert.match(system, /Explanation, investigation and review requests keep their own requested output/)
  assert.doesNotMatch(system, /Stop after the plan and wait for approval before implementation\./)
  assert.match(system, /Do not assign an error to a particular request/)
  assert.match(system, /Do not call a snippet the whole file/)
  assert.match(system, /modifying an existing object and creating, replacing or deleting one/)
  assert.match(system, /Do not invent a schema operation, destructive rollback/)
  assert.match(system, /reserved for the user or delegated to the agent/)
  assert.match(system, /Preserve every check or command explicitly requested by the user/)
  assert.match(system, /Within the protected scope, do not permit temporary/)
  assert.match(system, /Keep separately authorized outputs or changes authorized/)
})
