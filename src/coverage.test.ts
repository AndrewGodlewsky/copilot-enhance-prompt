import { assert, test } from '#testing'
import { clipboardTools, copyToClipboard } from './clipboard.ts'

test('clipboard: the right tool per OS, UTF-16 with a BOM for clip.exe; no tool is a clear failure', async () => {
  const windows = clipboardTools('win32')
  assert.deepEqual(windows.map((tool) => tool.command), ['clip.exe'])
  const bytes = windows[0].encode('Sửa lỗi 修复')
  assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xfe])
  assert.equal(bytes.subarray(2).toString('utf16le'), 'Sửa lỗi 修复')
  assert.deepEqual(clipboardTools('darwin').map((tool) => tool.command), ['pbcopy'])
  const linux = clipboardTools('linux')
  assert.deepEqual(linux.map((tool) => tool.command), ['wl-copy', 'xclip', 'xsel'])
  assert.equal(linux[1].encode('Sửa').toString('utf8'), 'Sửa')
  if (process.platform === 'win32') {
    // None of the Linux tools exist here: every one is tried, then a clear failure (no throw).
    const result = await copyToClipboard('x', 'linux')
    assert.equal(result.copied, false)
    assert.ok(result.error)
  }
})
