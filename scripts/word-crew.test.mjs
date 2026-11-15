import { test } from 'node:test'
import assert from 'node:assert/strict'
import { measureWords, mountWordCrew } from '../web/src/word-crew.ts'

class Element {
  children = []
  attrs = {}
  style = {}
  textContent = ''
  setAttribute(k, v) { this.attrs[k] = String(v) }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this.children = children }
}

test('SVG crew finishes only on success, translates text together, pauses, and disposes its frame', () => {
  const previous = [globalThis.document, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
  const frames = new Map()
  let next = 0
  globalThis.document = { createElementNS: () => new Element() }
  globalThis.requestAnimationFrame = cb => { frames.set(++next, cb); return next }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const advance = (ms) => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(ms)) }
  try {
    const svg = new Element()
    let completed = 0
    const input = [{ text: '<café>', x: 10, y: 20, width: 40 }, { text: '路径', x: 10, y: 40, width: 40 }]
    const original = structuredClone(input)
    const crew = mountWordCrew(svg, input, 200, 100, () => completed++)
    assert.equal(svg.children.length, 4)
    assert.equal(svg.children[1].attrs.stroke, 'var(--word-crew-ink)')
    assert.equal(svg.children[1].attrs['stroke-width'], '2.2')
    assert.equal(svg.children[0].children[0].textContent, '<café>', 'user text is rendered as text, never markup')
    advance(0); advance(100)
    const pose = JSON.stringify(svg.children[1])
    crew.pause(true)
    advance(200); advance(300)
    assert.equal(JSON.stringify(svg.children[1]), pose)
    assert.equal(completed, 0)
    crew.pause(false)
    // Finish during a carry, not before anyone has reached a word.
    for (let i = 0; i < 11; i++) advance(350 + i * 50)
    const head = svg.children[1].children[0].children[0]
    const heldWord = svg.children[2].children[0]
    const stopX = Number(head.attrs.cx)
    const heldX = Number(heldWord.attrs.x), heldY = Number(heldWord.attrs.y)
    assert.equal(heldWord.attrs.opacity, '1')
    crew.pause(true)
    crew.retire()
    advance(900)
    assert.equal(Number(head.attrs.cx), stopX, 'set the word down before running away')
    assert.equal(Number(heldWord.attrs.x), heldX, 'lower at the current position, without snapping to a slot')
    assert.ok(Number(heldWord.attrs.y) > heldY, 'the carried word lowers instead of freezing in midair')
    for (let i = 0; i < 7; i++) advance(950 + i * 50)
    const placedY = heldWord.attrs.y
    assert.notEqual(Number(head.attrs.cx), stopX, 'the carrier leaves after placing its word')
    for (let i = 7; i < 25; i++) { crew.retire(); advance(950 + i * 50) }
    assert.equal(heldWord.attrs.y, placedY, 'the placed word never follows its departing carrier')
    assert.ok(svg.children[1].children.every(group => group.style.visibility === 'hidden'))
    assert.equal(svg.children[0].attrs.transform, 'translate(0 0)')
    assert.equal(svg.children[3].attrs.d, '')
    assert.equal(completed, 0, '95% is not successful completion')
    assert.equal(frames.size, 0, 'a settled scene does not keep rendering while waiting for the model')
    const waiting = JSON.stringify(svg)
    advance(60_000)
    assert.equal(JSON.stringify(svg), waiting)
    crew.finish(); crew.finish()
    for (let i = 0; i < 6; i++) advance(60_050 + i * 50)
    assert.equal(svg.children[0].attrs.transform, svg.children[2].attrs.transform, 'standing and carried words share one translation')
    assert.match(svg.children[0].attrs.transform, /translate\(0 [1-9]/)
    for (let i = 6; i < 20; i++) { crew.finish(); advance(60_050 + i * 50) }
    assert.equal(completed, 1)
    assert.equal(frames.size, 0)

    const fastSvg = new Element()
    const fast = mountWordCrew(fastSvg, input, 200, 100, () => completed++)
    fast.finish()
    for (let i = 0; i < 13; i++) advance(70_000 + i * 50)
    assert.equal(fastSvg.children[0].attrs.transform, 'translate(0 0)', 'a fast success still waits for set-down and exit')
    assert.equal(completed, 1)
    for (let i = 13; i < 40; i++) advance(70_000 + i * 50)
    assert.equal(completed, 2)
    fast.dispose()
    crew.dispose()
    assert.deepEqual(input, original)

    const cancelled = mountWordCrew(new Element(), input, 200, 100, () => completed++)
    cancelled.retire()
    cancelled.dispose()
    advance(3000)
    assert.equal(completed, 2, 'disposal does not play or signal success')
    assert.equal(frames.size, 0)
  } finally {
    [globalThis.document, globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = previous
  }
})

test('native layout measurement preserves text and scroll position, with safe bounded fallbacks', () => {
  const previous = [globalThis.document, globalThis.getComputedStyle]
  const source = '  café\n路径  '
  const input = { value: source, clientWidth: 300, clientHeight: 112, scrollTop: 20, scrollLeft: 0 }
  const style = { padding: '20px 12px 8px', fontStyle: 'normal', fontWeight: '400', fontSize: '14px', fontFamily: 'sans-serif', lineHeight: '20px', letterSpacing: 'normal', tabSize: '8', direction: 'ltr', textAlign: 'start' }
  let mirror, removed = 0, split = false, fail = false, offset = 0
  globalThis.getComputedStyle = () => style
  globalThis.document = {
    body: { append() {} },
    createElement(tag) {
      if (tag === 'canvas') return { getContext: () => ({ measureText: () => ({ fontBoundingBoxAscent: 13, fontBoundingBoxDescent: 3 }) }) }
      mirror = { style: {}, append(node) { this.text = node.data }, getBoundingClientRect: () => ({ top: 0, left: 0 }), remove() { removed++ } }
      return mirror
    },
    createTextNode: data => ({ data }),
    createRange: () => ({ setStart(node, index) { offset = index }, setEnd() {}, getClientRects() {
      if (fail) throw Error('layout unavailable')
      const rect = { top: offset === 2 ? 22 : 42, left: 12, height: 16, width: offset === 2 ? 28 : 14 }
      return split ? [rect, rect] : [rect]
    } })
  }
  try {
    assert.deepEqual(measureWords(input), [
      { text: 'café', x: 12, y: 15, width: 28 },
      { text: '路径', x: 12, y: 35, width: 14 }
    ])
    assert.equal(mirror.text, source)
    assert.equal(input.value, source)
    assert.equal(mirror.style.padding, style.padding)
    assert.equal(mirror.style.lineHeight, '20px')
    assert.equal(mirror.style.width, '300px')
    assert.equal(removed, 1)
    split = true
    assert.equal(measureWords(input), null, 'fragmented words keep the original editor visible')
    assert.equal(removed, 2)
    fail = true
    assert.throws(() => measureWords(input), /layout unavailable/)
    assert.equal(removed, 3, 'temporary copy is removed even when layout fails')
    assert.equal(measureWords({ ...input, value: 'x'.repeat(20_001) }), null)
    assert.equal(removed, 3, 'large requests skip decorative measurement')
    assert.equal(input.value, source)
  } finally {
    [globalThis.document, globalThis.getComputedStyle] = previous
  }
})
