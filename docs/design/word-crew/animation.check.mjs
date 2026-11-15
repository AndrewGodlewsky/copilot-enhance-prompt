import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const html = readFileSync(new URL('./animation-preview.html', import.meta.url), 'utf8')
const scripts = [...html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)]
assert.equal(scripts.length, 2)
for (const [, , source] of scripts) new vm.Script(source)
assert.ok(Buffer.byteLength(html) < 512 * 1024)
assert.doesNotMatch(html, /<script[^>]+src=|\bfetch\s*\(|\blocalStorage\b/)

const context = vm.createContext({})
vm.runInContext(scripts[0][2], context)
const { crewCount, layoutWords, makeJobs, transport, body } = context.CrewMotion
assert.equal(crewCount(''), 0)
assert.equal(crewCount('word '.repeat(10)), 1)
assert.equal(crewCount('word '.repeat(11)), 2)
assert.equal(crewCount('fix café 路径 🧑‍💻'), 1)
const input = 'Keep café, identifiers like getUser(), paths like src/main.ts, and quoted words unchanged while the decorative crew moves around.'
const words = layoutWords(input, 450, word => word.length * 7)
const before = JSON.stringify(words)
const jobs = makeJobs(words, 450)
assert.equal(jobs.length, crewCount(input))
assert.equal(new Set(jobs.map(job => job.index)).size, jobs.length)
for (const job of jobs) {
  if (job.replaced !== undefined) {
    assert.ok(words[job.replaced].width >= words[job.index].width, 'Destination must fit the carried word')
    assert.ok(!jobs.some(other => other.index === job.replaced), 'Do not remove another figure\'s word')
  }
}
const phases = new Set()
for (const job of jobs) {
  let previous
  for (let t = 0; t < 40; t += .01) {
    const pose = transport(job, t)
    const b = body(pose)
    phases.add(pose.phase)
    const points = [b.head, b.hip, b.shoulder, ...b.arms.flat(), ...b.legs.flat()]
    assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
    if (pose.grip === 1) {
      assert.equal(b.hands[0].y, pose.word.y)
      assert.equal(b.hands[1].y, pose.word.y)
      assert.equal(b.hands[0].x, pose.word.x - 4)
      assert.equal(b.hands[1].x, pose.word.x + 4)
    }
    if (pose.phase === 'Carry') {
      const top = Math.min(b.head.y - 3.5, ...points.map(p => p.y)) - .8
      const bottom = Math.max(...points.map(p => p.y)) + .8
      assert.ok(bottom - top <= 28.01, `Figure exceeds 28px: ${bottom-top}`)
    }
    if (previous) {
      assert.ok(Math.hypot(pose.word.x - previous.word.x, pose.word.y - previous.word.y) < 2, 'Word must not jump between phases')
      assert.ok(Math.abs(pose.x - previous.x) < 3, 'Figure must not jump between phases')
    }
    previous = pose
  }
}
for (const phase of ['Approach', 'Reach', 'Lift', 'Carry', 'Set down', 'Release', 'Ready']) assert.ok(phases.has(phase), phase)
assert.equal(JSON.stringify(words), before, 'Motion must not mutate source words')

// Exercise the standalone controls without starting a browser or making model calls.
class Element {
  constructor(htmlElement = true) {
    this.attributes = {}; this.children = []; this.style = {}; this.listeners = {}
    this.value = ''; this.disabled = false; this.clientWidth = 700
    // HTMLElement.hidden reflects an attribute; SVGElement has no such property.
    if (htmlElement) Object.defineProperty(this, 'hidden', {
      get: () => this.hasAttribute('hidden'),
      set: value => value ? this.setAttribute('hidden', '') : this.removeAttribute('hidden')
    })
    const classes = new Set()
    this.classList = { toggle: value => { if (classes.delete(value)) return false; classes.add(value); return true } }
  }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  getAttribute(key) { return this.attributes[key] }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key) }
  removeAttribute(key) { delete this.attributes[key] }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this.children = children }
  addEventListener(name, callback) { this.listeners[name] = callback }
  getContext() { return { measureText: value => ({ width: value.length * 7 }) } }
  click() { if (!this.disabled) this.listeners.click?.() }
}
const elements = new Map([...html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)].map(([,tag,attrs,id]) => {
  const element = new Element(!['svg', 'g', 'path'].includes(tag))
  if (/\bhidden(?:\s|$|=)/.test(attrs)) element.setAttribute('hidden', '')
  return [id, element]
}))
const get = id => { assert.ok(elements.has(id), `Unknown DOM element: ${id}`); return elements.get(id) }
get('request').value = input
get('zoom').value = '1'
get('speed').value = '1'
let callback, now = 0
const app = vm.createContext({
  document: { getElementById: get, createElementNS: () => new Element(false), createElement: () => new Element(), addEventListener() {} },
  window: { matchMedia: () => ({ matches: false }) },
  performance: { now: () => now },
  ResizeObserver: class { observe() {} },
  requestAnimationFrame: fn => { callback = fn; return 1 },
  cancelAnimationFrame: () => { callback = undefined }
})
vm.runInContext(scripts.map(([, , source]) => source).join('\n'), app)
const advance = seconds => { for (let t=0;t<seconds;t+=.02) { now+=20; const fn=callback; callback=undefined; fn?.(now) } }
assert.equal(get('scene').hasAttribute('hidden'), true)
get('start').click()
assert.equal(get('request').readOnly, true)
assert.equal(get('scene').hasAttribute('hidden'), false, 'The SVG must lose its hidden attribute before the original request becomes invisible')
assert.ok(get('words').children.length > 0, 'The visible SVG must contain request words')
assert.ok(get('people').children.length > 0, 'The visible SVG must contain figures')
const firstHead = get('people').children[0].children[0]
const initialHeadX = firstHead.getAttribute('cx')
advance(5)
assert.notEqual(firstHead.getAttribute('cx'), initialHeadX, 'A visible figure must move after playback starts')
assert.equal(get('request').value, input)
get('pause').click()
const pausedProgress = get('progress').getAttribute('aria-valuenow')
advance(2)
assert.equal(get('progress').getAttribute('aria-valuenow'), pausedProgress)
get('pause').click()
get('complete').click()
assert.equal(get('progress').getAttribute('aria-valuenow'), '100')
advance(3)
assert.equal(get('request').readOnly, false)
assert.equal(get('result').hidden, false)
assert.equal(get('request').value, input)
for (const action of ['cancel', 'fail']) {
  get('start').click(); advance(3); get(action).click()
  assert.equal(get('request').value, input)
  assert.equal(get('request').readOnly, false)
  assert.equal(get('scene').hasAttribute('hidden'), true)
  assert.equal(get('result').hidden, true)
  assert.equal(callback, undefined)
}
get('reduced').checked = true
get('start').click(); advance(1); get('complete').click()
assert.equal(get('people').style.visibility, 'hidden')
assert.equal(get('request').readOnly, false)
assert.equal(get('request').value, input)
assert.equal(get('result').hidden, false)
get('start').click(); advance(19)
assert.equal(get('progress').getAttribute('aria-valuenow'), '100')
assert.equal(get('request').readOnly, false)
assert.match(get('status').textContent, /Preview complete/)
get('reduced').checked = false
get('start').click(); advance(21)
assert.equal(get('result').hidden, false)
assert.equal(get('request').readOnly, false)
assert.equal(get('request').value, input)

const wordLayer = get('words')
const append = wordLayer.append
wordLayer.append = () => { throw new Error('Injected startup drawing failure') }
get('start').click()
wordLayer.append = append
assert.equal(get('request').readOnly, false)
assert.equal(get('request').value, input)
assert.equal(get('scene').hasAttribute('hidden'), true)
assert.match(get('status').textContent, /could not render/)
assert.equal(callback, undefined)

get('start').click()
const lines = get('people').children[0].children[1]
lines.setAttribute = () => { throw new Error('Injected frame drawing failure') }
advance(.1)
assert.equal(get('request').readOnly, false)
assert.equal(get('request').value, input)
assert.equal(get('scene').hasAttribute('hidden'), true)
assert.match(get('status').textContent, /could not render/)
assert.equal(callback, undefined)
get('start').click(); advance(.1)
assert.equal(get('scene').hasAttribute('hidden'), false, 'Retry must create a fresh visible scene')
get('cancel').click()
console.log('PASS: syntax, standalone size, crew count, Unicode preservation, 28px carrying height, hand/word contact, continuous motion, SVG attribute visibility, visible figure movement, input locking, pause, completion, cancellation, failure, reduced motion, and startup/frame error recovery. Visual timing still requires owner review.')
