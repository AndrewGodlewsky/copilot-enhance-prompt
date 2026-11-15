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
    assert.equal(svg.children[0].children[0].textContent, '<café>', 'user text is rendered as text, never markup')
    advance(0); advance(100)
    const pose = JSON.stringify(svg.children[1])
    crew.pause(true)
    advance(200); advance(300)
    assert.equal(JSON.stringify(svg.children[1]), pose)
    assert.equal(completed, 0)
    crew.pause(false)
    crew.finish()
    for (let i = 0; i < 20; i++) advance(400 + i * 50)
    assert.equal(svg.children[0].attrs.transform, svg.children[2].attrs.transform, 'standing and carried words share one translation')
    assert.match(svg.children[0].attrs.transform, /translate\(0 [1-9]/)
    for (let i = 20; i < 35; i++) advance(400 + i * 50)
    assert.equal(completed, 1)
    assert.equal(frames.size, 0)
    crew.dispose()
    assert.deepEqual(input, original)

    const cancelled = mountWordCrew(new Element(), input, 200, 100, () => completed++)
    cancelled.dispose()
    advance(3000)
    assert.equal(completed, 1, 'disposal does not play or signal success')
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
