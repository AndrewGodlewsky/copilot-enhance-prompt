import { read, set } from '#panel'
import { assert, mockHost, test } from '#testing'
import { mountPanel } from './panel/testing.ts'
import { attachFiles, uploadingNames } from './panel/attach.ts'
import { clearRequest, enhanceNow, enhanceAndSend } from './panel/actions.ts'
import { draft, files, notice, result, sendAfterEnhance } from './panel/state.ts'
import { discardUpload, failedUploads, pendingUploads } from './panel/uploads.ts'
import { ATTACHMENT_CHUNK_BYTES } from './image-limits.ts'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

test('the entire chosen attachment set blocks both enhancement paths until all uploads settle', async () => {
  const first = deferred(), second = deferred(), entered = deferred()
  const calls: unknown[] = [], sent: unknown[] = []
  let uploads = 0
  const host = mockHost({ settings: { allowTerminalSend: true }, requests: {
    'models.get': { profiles: [], selectorProfileId: null },
    'targets.list': { targets: [{ terminalId: 't', label: 'Copilot', agent: 'copilot', state: 'waiting' }], workspace: 'main', project: 'Test', workspaceId: 'w' },
    'attachments.put': async input => {
      const hold = ++uploads === 1 ? first : second
      entered.resolve()
      await hold.promise
      return { path: `/attachments/${input.id}/${input.name}`, bytes: input.size! }
    },
    'prompt.enhance': input => { calls.push(input); return { enhanced: 'Ready', model: 'm', profileName: 'm', ms: 1, attempts: [], context: [], notes: [] } },
    'prompt.send': input => { sent.push(input); return { accepted: true } }
  } })
  const panel = await mountPanel(host)
  set(draft, 'Use both attachments')
  set(sendAfterEnhance, true)
  const uploading = attachFiles([new File(['one'], 'same.txt'), new File(['two'], 'same.txt')], () => {})
  await entered.promise
  try {
    assert.equal(uploadingNames().length, 2, 'reserve every selected file before awaiting the first')
    await enhanceNow()
    await enhanceAndSend()
    assert.deepEqual(calls, [])
    assert.deepEqual(sent, [])
    assert.equal(clearRequest(), false)
    assert.match(read(notice)?.text ?? '', /attachments.*upload/i)
    first.resolve()
    await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(read(files).length, 1)
    assert.equal(uploadingNames().length, 1, 'same-name uploads remain distinct')
    await enhanceAndSend()
    assert.deepEqual(calls, [])
    second.resolve()
    await uploading
    await enhanceNow()
    assert.deepEqual((calls[0] as { files: string[] }).files, read(files).map(file => file.path))
    assert.equal(read(files).length, 2)
    assert.equal(read(result), 'Ready')
    assert.deepEqual(sent, [], 'upload completion does not automatically send anything')
  } finally {
    first.resolve(); second.resolve()
    await uploading
    await panel.unmount()
  }
})

test('a final-chunk failure stays actionable and blocks enhancement until explicitly removed', async () => {
  let runs = 0, chunks = 0, fail = true
  const size = ATTACHMENT_CHUNK_BYTES + 4
  const host = mockHost({ requests: {
    'attachments.put': input => {
      chunks++
      if (input.index < input.total - 1) return { received: input.index + 1 }
      if (fail) throw new Error('Connection lost on final chunk')
      return { path: `/attachments/${input.id}/notes.txt`, bytes: size }
    },
    'prompt.enhance': () => { runs++; return { enhanced: 'Ready', model: 'm', profileName: 'm', ms: 1, attempts: [], context: [], notes: [] } }
  } })
  const panel = await mountPanel(host)
  set(draft, 'Use the notes')
  try {
    const file = new File(['x'.repeat(size)], 'notes.txt')
    await attachFiles([file], () => {})
    assert.equal(chunks, 2)
    assert.equal(read(files).length, 0)
    assert.equal(read(pendingUploads).length, 0)
    assert.match(read(failedUploads)[0].error, /Connection lost/)
    await enhanceNow(); await enhanceAndSend()
    assert.equal(runs, 0)
    assert.match(read(notice)?.text ?? '', /Remove the failed attachment/)
    discardUpload(read(failedUploads)[0].id)
    fail = false
    await attachFiles([file], () => {})
    assert.equal(read(files).length, 1)
    assert.equal(read(failedUploads).length, 0)
    assert.equal(runs, 0, 'successful reattachment needs a fresh Enhance click')
    await enhanceNow()
    assert.equal(runs, 1)
    assert.equal(clearRequest(), true)
    assert.equal(read(files).length, 0)
  } finally { await panel.unmount() }
})

test('Cancel and closing a panel discard late upload results without changing restored drafts', async () => {
  for (const close of [false, true]) {
    const hold = deferred(), entered = deferred()
    const host = mockHost({ requests: { 'attachments.put': async input => {
      entered.resolve(); await hold.promise
      return { path: '/attachments/late/file.txt', bytes: input.size! }
    } } })
    const panel = await mountPanel(host)
    set(draft, 'Original draft')
    const upload = attachFiles([new File(['contents'], 'file.txt')], () => {})
    await entered.promise
    if (close) await panel.unmount()
    else discardUpload(read(pendingUploads)[0].id)
    hold.resolve()
    await upload
    assert.equal(read(files).length, 0)
    assert.equal(read(pendingUploads).length, 0)
    assert.equal(read(failedUploads).length, 0)
    assert.equal(read(draft), 'Original draft')
    if (!close) await panel.unmount()
    const reopened = await mountPanel(host)
    assert.equal(read(pendingUploads).length, 0)
    await reopened.unmount()
  }
})

test('an incomplete final upload response cannot become an attached file and Clear removes failed uploads', async () => {
  const panel = await mountPanel(mockHost({ requests: { 'attachments.put': { received: 1 } } }))
  try {
    await attachFiles([new File(['content'], 'incomplete.txt')], () => {})
    assert.equal(read(files).length, 0)
    assert.match(read(failedUploads)[0].error, /did not finish/)
    assert.equal(clearRequest(), true)
    assert.equal(read(failedUploads).length, 0)
  } finally { await panel.unmount() }
})
