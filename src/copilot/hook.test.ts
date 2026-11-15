import { test, assert } from '#testing'
import { rewriteTransformed } from './hook.ts'
import { runPromptHook } from './hook.ts'
import { persistentStore } from './storage.ts'
import { sentKey } from './sent.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('a transformed hook preserves host context and changes only a unique user prompt', async () => {
  const rewrite = async () => 'Enhanced request'
  assert.deepEqual(await rewriteTransformed({ prompt: 'Original', transformedPrompt: 'Context\nOriginal\nAttachments' }, rewrite), { modifiedTransformedPrompt: 'Context\nEnhanced request\nAttachments' })
  for (const transformedPrompt of ['No recognizable prompt', 'Original and Original']) {
    let called = false
    assert.deepEqual(await rewriteTransformed({ prompt: 'Original', transformedPrompt }, async () => { called = true; return 'changed' }), {})
    assert.equal(called, false)
  }
})

test('hook failures and empty rewrites leave the complete original content unchanged', async () => {
  const input = { prompt: 'Original', transformedPrompt: 'Original' }
  assert.deepEqual(await rewriteTransformed(input, async () => { throw new Error('offline') }), {})
  assert.deepEqual(await rewriteTransformed(input, async () => ''), {})
})

test('overlapping original-text matches are ambiguous and never invoke the rewriter', async () => {
  let called = false
  const result = await rewriteTransformed({ prompt: 'abababab', transformedPrompt: 'Context\nababababab\nAttachment' }, async () => {
    called = true
    return 'Changed'
  })
  assert.deepEqual(result, {})
  assert.equal(called, false)
})

test('the file hook applies opted-in rules, bypasses a panel send, and remains off by default', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-hook-test-'))
  const input = { sessionId: 'test', cwd: directory, prompt: 'Original request', transformedPrompt: 'Context\nOriginal request' }
  try {
    assert.deepEqual(await runPromptHook(input, directory), {})
    const prefs = persistentStore(join(directory, 'preferences'))
    assert.equal(await prefs.get('effortMediumModel'), null, 'a prompt hook must not initialize composer assignments')
    await prefs.set('autoEnhanceMode', 'rules')
    await prefs.set('autoEnhanceAppend', 'Run tests.')
    assert.deepEqual(await runPromptHook(input, directory), { modifiedTransformedPrompt: 'Context\nOriginal request\n\nRun tests.' })
    await persistentStore(join(directory, 'data')).set(sentKey('test', input.prompt), Date.now() + 10000)
    assert.deepEqual(await runPromptHook(input, directory), {})
    assert.deepEqual(await runPromptHook({ ...input, agentId: 'subagent' }, directory), {})
  } finally { await rm(directory, { recursive: true, force: true }) }
})
