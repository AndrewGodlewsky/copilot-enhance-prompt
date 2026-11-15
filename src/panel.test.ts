// `host plugin test .` runs this in Node with the same runtime and checks the host uses. The panel's
// state and actions run here without anything drawn (src/panel/testing.ts): what the web panel's
// buttons call is called directly, and what it shows is read from the state.
import { read, set } from '#panel'
import { assert, mockHost, test } from '#testing'
import { attachmentItemId } from './image-limits.ts'
import { enhanceNow, openForm, patchForm, removeFile, saveForm, send, openIssues, toggleItem } from './panel/actions.ts'
import { contextShown, draft, enabledProfiles, excluded, files, form, lastRun, notice, put, result } from './panel/state.ts'
import { mountPanel } from './panel/testing.ts'
import { ISSUES_URL, modelWarning, optionsSummary } from './panel/view.ts'
import { type ProfileView } from './presets.ts'
import type { ModelsView, ProfileInput } from './protocol.ts'

const gpt: ProfileView = {
  id: 'gpt', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5-mini', enabled: true, effectiveModel: 'gpt-5-mini'
}

const modelsView = (profiles: ProfileView[]): ModelsView => ({ profiles, selectorProfileId: null })

test('enhances with context, then sends to the chosen agent', async () => {
  const sent: { terminalId: string; text: string }[] = []
  const enhanceInputs: { level?: string; exclude?: string[] }[] = []
  const host = mockHost({
    requests: {
      'models.get': modelsView([gpt]),
      'targets.list': { targets: [{ terminalId: 't1', label: 'Claude · waiting', agent: 'claude' }] },
      'prompt.enhance': (input) => {
        enhanceInputs.push(input)
        return {
          enhanced: `Better: ${input.prompt}`,
          model: 'gpt-4.1-mini',
          profileName: 'OpenAI',
          ms: 1200,
          attempts: [
            { profileId: 'x', name: 'Down', model: 'm', ok: false, error: '503: overloaded', ms: 10 },
            { profileId: 'gpt', name: 'OpenAI', model: 'gpt-4.1-mini', ok: true, ms: 1100 }
          ],
          context: [
            { id: 'rules:AGENTS.md', kind: 'rules', label: 'AGENTS.md', chars: 120 },
            { id: 'tree', kind: 'tree', label: 'Repository tree', chars: 800 }
          ],
          notes: []
        }
      },
      'prompt.send': (input) => {
        sent.push(input)
        return { accepted: true }
      }
    }
  })
  const view = await mountPanel(host)
  assert.equal(modelWarning(), null)
  put(draft, 'add tests')
  await enhanceNow()
  assert.equal(read(result), 'Better: add tests')
  assert.equal(enhanceInputs[0].level, 'standard')
  // The model that failed first stays with the result (the card says "Fell back after: …").
  assert.deepEqual(
    read(lastRun)?.attempts.filter((attempt) => !attempt.ok).map((attempt) => `${attempt.name} (${attempt.error})`),
    ['Down (503: overloaded)']
  )
  assert.deepEqual(read(contextShown).map((item) => item.id), ['rules:AGENTS.md', 'tree'])

  // Untick the tree, enhance again: the worker is told, and the item stays listed (unticked).
  toggleItem('tree', false)
  // The options button names the current choice.
  assert.equal(optionsSummary(), 'General · Project overview')
  await enhanceNow()
  assert.deepEqual(enhanceInputs[1].exclude, ['tree'])
  assert.deepEqual(read(contextShown).map((item) => item.id), ['rules:AGENTS.md', 'tree'])

  await send(read(result))
  assert.deepEqual(sent, [{ terminalId: 't1', text: 'Better: add tests', enter: false }])
  assert.deepEqual(read(notice), { tone: 'success', text: 'Sent to Claude · waiting.' })
  assert.deepEqual(view.errors, [])
  assert.deepEqual(view.refusals, [])
  await view.unmount()
})

test('an attached text can be unticked like any context item, and leaves the list when its file is removed', async () => {
  const log = { path: '/tmp/enhance-prompt-attachments/att-abc123/build.log', name: 'build.log', bytes: 30, type: 'text/plain' }
  // A second file of the same name (another folder's build.log): its own item.
  const other = { path: 'C:\\Temp\\enhance-prompt-attachments\\att-def456\\build.log', name: 'build.log', bytes: 40, type: 'text/plain' }
  const inputs: { files?: string[]; exclude?: string[] }[] = []
  const host = mockHost({
    requests: {
      'models.get': modelsView([gpt]),
      'targets.list': { targets: [] },
      'prompt.enhance': (input) => {
        inputs.push(input)
        const attached = (input.files ?? []).map((path) => ({ id: attachmentItemId(path), kind: 'file', label: 'build.log', chars: 30 }))
        return {
          enhanced: 'Better',
          model: 'gpt-4.1-mini',
          profileName: 'OpenAI',
          ms: 10,
          attempts: [],
          // As the worker answers: an unticked item is not in the context of the run.
          context: [...attached, { id: 'tree', kind: 'tree', label: 'Repository tree', chars: 800 }].filter((item) => !(input.exclude ?? []).includes(item.id)),
          notes: []
        }
      }
    }
  })
  const view = await mountPanel(host)
  put(files, [log, other])
  put(draft, 'fix the build')
  await enhanceNow()
  assert.deepEqual(inputs[0].files, [log.path, other.path])
  assert.deepEqual(read(contextShown).map((item) => item.id), ['attach:att-abc123/build.log', 'attach:att-def456/build.log', 'tree'])

  // Unticked: the worker is told to leave its text out, and the item stays listed to tick again.
  toggleItem('attach:att-abc123/build.log', false)
  await enhanceNow()
  assert.deepEqual(inputs[1].exclude, ['attach:att-abc123/build.log'])
  assert.deepEqual(inputs[1].files, [log.path, other.path])
  assert.deepEqual(read(contextShown).map((item) => item.id).sort(), ['attach:att-abc123/build.log', 'attach:att-def456/build.log', 'tree'])

  // The file is removed: its item goes with it (nothing left to tick), the other build.log stays.
  removeFile(log.path)
  assert.deepEqual(read(files), [other])
  assert.deepEqual(read(contextShown).map((item) => item.id).sort(), ['attach:att-def456/build.log', 'tree'])
  assert.deepEqual(read(excluded), [])
  await enhanceNow()
  assert.deepEqual(inputs[2].files, [other.path])
  assert.deepEqual(inputs[2].exclude, [])
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('Feedback opens the issue page without reminder state', async () => {
  const host = mockHost({ requests: {
    'models.get': modelsView([gpt]), 'targets.list': { targets: [] },
    'prompt.enhance': () => ({ enhanced: 'Improved prompt', model: 'gpt-5-mini', profileName: 'GitHub Copilot', ms: 1, attempts: [], context: [], notes: [] })
  } })
  const view = await mountPanel(host)
  put(draft, 'Improve this prompt')
  for (let run = 0; run < 6; run++) await enhanceNow()
  await openIssues()
  assert.deepEqual(host.callsOf('shell.openExternal'), [{ url: ISSUES_URL }])
  await view.settled()
  assert.equal(Object.hasOwn(view.persisted.plugin, 'feedbackAsk'), false)
  assert.equal(Object.hasOwn(view.persisted.plugin, 'feedbackOff'), false)
  await view.unmount()
})

test('warns when no model is configured, and adds one from the Models tab', async () => {
  const saved: ProfileInput[] = []
  const host = mockHost({
    requests: {
      'models.get': modelsView([]),
      'targets.list': { targets: [] },
      'models.save': (input) => {
        saved.push(input)
        return modelsView([{ ...gpt, ...input, id: 'new' }])
      }
    }
  })
  const view = await mountPanel(host)
  assert.equal(modelWarning(), 'no-model')
  // Add model: select a model available through the attached Copilot session.
  openForm()
  patchForm({ model: 'gpt-5-mini' })
  await saveForm()
  assert.deepEqual(saved[0], { name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5-mini', enabled: true })
  // The form closes, the model is there and the warning is gone.
  assert.equal(read(form), null)
  assert.deepEqual(read(enabledProfiles).map((profile) => profile.id), ['new'])
  assert.equal(modelWarning(), null)
  assert.deepEqual(view.errors, [])
  await view.unmount()
})
