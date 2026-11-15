// Attached images: recognised by their bytes, sent to models that can see them, always listed for the agent.
import { rmSync } from 'node:fs'
import { after } from 'node:test'
import { assert, mockHost, mountWorker, test } from '#testing'
import { ATTACHMENTS_DIR, putChunk } from './attachments.ts'
import { sniffImage } from './images.ts'
import * as main from './worker.ts'

// The tests' own attachments folder goes when they are done.
after(() => rmSync(ATTACHMENTS_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }))

// A real 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** Attaches the picture as the panel does (attachments.put) and answers with the path of its copy. */
async function attach(id: string, name = 'login bug.png'): Promise<string> {
  const done = await putChunk({ id, name, index: 0, total: 1, data: PNG.toString('base64') })
  assert.ok('path' in done)
  return done.path
}

test('images are recognised by their bytes, not by their name', () => {
  assert.equal(sniffImage(PNG), 'image/png')
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniffImage(Buffer.from('GIF89a')), 'image/gif')
  assert.equal(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp')
  assert.equal(sniffImage(Buffer.from('%PDF-1.7')), null)
  assert.equal(sniffImage(Buffer.from('not an image')), null)
})

test('the worker sends image bytes to Copilot and preserves every attached path', async () => {
  const png = await attach('att-image-data')
  const host = mockHost({
    storage: { models: { profiles: [{ id: 'm', name: 'Copilot', preset: 'copilot', provider: 'copilot', model: 'fixture', enabled: true }] } },
    results: { 'copilot.rewrite': { text: 'Fix the login button.' } }
  })
  const worker = await mountWorker(main, { host })
  try {
    const answer = await worker.request('prompt.enhance', { prompt: 'the button is cut off', level: 'off', files: [png] })
    assert.ok(answer.enhanced.includes(png))
    const sent = host.callsOf('copilot.rewrite')[0]
    assert.deepEqual(sent.images, [{ type: 'image/png', base64: PNG.toString('base64') }])
    assert.match(sent.user, /<attached_images>\n1\. .*login bug\.png/)
    assert.ok(!sent.user.includes('<attached_files>'))
  } finally { await worker.deactivate() }
})
