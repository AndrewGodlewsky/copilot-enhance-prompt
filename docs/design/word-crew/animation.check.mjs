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
const { crewCount, layoutWords, makeCrew, sampleCrew, seededRandom, body, finishFrame, finishPose, LINE_HEIGHT, MOTION_SPEED } = context.CrewMotion
for (const file of ['animation-preview.html', 'color-preview.html']) {
  const preview = readFileSync(new URL(file, import.meta.url), 'utf8')
  const source = /<script id="[^"]+">([\s\S]*?)<\/script>/.exec(preview)[1]
  const sandbox = vm.createContext({})
  vm.runInContext(source, sandbox)
  const motion = sandbox.CrewMotion
  const pair = motion.makeCrew(motion.layoutWords('first second', 200, text => text.length * 7), 200, 1)
  for (let i = 0; i < 30; i++) {
    const last = pair.actors[0].job
    motion.sampleCrew(pair, last.endsAt)
    assert.notEqual(pair.actors[0].job.from, last.to, `${file}: walk to a different pickup location`)
    assert.notEqual(pair.actors[0].job.word, last.word, `${file}: choose a different word`)
  }
  const solo = motion.makeCrew(motion.layoutWords('solo', 200, () => 30), 200, 1)
  motion.sampleCrew(solo, 60)
  assert.equal(solo.completed, 1, `${file}: wait when no different word exists`)
}
assert.equal(crewCount(''), 0)
assert.equal(crewCount('word '.repeat(10)), 1)
assert.equal(crewCount('word '.repeat(11)), 2)
assert.equal(crewCount('fix café 路径 🧑‍💻'), 1)
const input = 'Keep café, identifiers like getUser(), paths like src/main.ts, and quoted words unchanged while the decorative crew moves around.'
const words = layoutWords(input, 450, word => word.length * 7)
const before = JSON.stringify(words)
assert.equal(LINE_HEIGHT, 24)
assert.match(html, /font:14px\/24px system-ui/, 'Editing and animation must share line spacing')
assert.equal(MOTION_SPEED, 2.5)
const rows = [...new Set(words.map(w => w.y))]
for (let i = 1; i < rows.length; i++) assert.equal(rows[i] - rows[i-1], 24)
const spaced = layoutWords('one   two\nthree\n\nfour', 450, word => word.length * 7)
assert.equal(spaced[1].x - spaced[0].x, 42, 'Preserve spaces')
assert.equal(spaced[2].y - spaced[1].y, 24, 'Preserve explicit line breaks')
assert.equal(spaced[3].y - spaced[2].y, 48, 'Preserve blank lines')
const randomA=seededRandom(123), randomB=seededRandom(123)
for(let i=0;i<100;i++)assert.equal(randomA(),randomB())
const crew = makeCrew(words, 450, 123)
assert.equal(crew.actors.length, crewCount(input))
assert.notEqual(JSON.stringify(crew.actors), JSON.stringify(makeCrew(words,450,456).actors), 'Different seeds should vary the first jobs')
const phases = new Set()
const jobsSeen = new Set()
const slotsBefore = crew.slots.map(s => ({x:s.x,y:s.y,capacity:s.capacity}))
let previous = [], previousJobs = []
for (let t = 0; t < 40; t += .02) {
  const world = sampleCrew(crew, t)
  const reservations = new Set()
  for (const actor of crew.actors) {
    const job=actor.job
    jobsSeen.add(`${job.from}:${job.to}`)
    for(const index of new Set([job.from,job.to])) {
      assert.ok(!reservations.has(index), 'Two figures must not handle the same word')
      reservations.add(index)
    }
    assert.ok(job.word.width<=crew.slots[job.to].capacity, 'A carried word must fit the destination')
  }
  crew.slots.forEach((s,i)=>{
    assert.deepEqual({x:s.x,y:s.y,capacity:s.capacity},slotsBefore[i], 'Text lines and slot widths must not expand')
    assert.ok(s.word.width <= s.capacity, 'Replacement words must fit the existing line')
  })
  for (const [i,pose] of world.poses.entries()) {
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
    if (pose.phase === 'Carry' || pose.phase === 'Make room') {
      const top = Math.min(b.head.y - 3.5, ...points.map(p => p.y)) - .8
      const bottom = Math.max(...points.map(p => p.y)) + .8
      assert.ok(bottom - top <= 28.01, `Figure exceeds 28px: ${bottom-top}`)
    }
    if (previous[i]) {
      if(pose.carrying&&previous[i].carrying&&previousJobs[i]===crew.actors[i].job)assert.ok(Math.hypot(pose.word.x-previous[i].word.x,pose.word.y-previous[i].word.y)<4.1, 'Carried word must not jump between phases')
      assert.ok(Math.hypot(pose.x-previous[i].x,pose.foot-previous[i].foot)<10, 'Figure must not teleport between jobs')
    }
  }
  previous=world.poses
  previousJobs=crew.actors.map(a=>a.job)
}
for (const phase of ['Run to a word', 'Reach', 'Lift', 'Carry', 'Make room', 'Set down', 'Release', 'Next word']) assert.ok(phases.has(phase), phase)
assert.ok(jobsSeen.size > 10, 'The crew must choose fresh words and destinations')
assert.ok(crew.completed > 10, 'The crew must finish multiple jobs')
const oneStep = makeCrew(words,450,123)
assert.equal(JSON.stringify(sampleCrew(crew,40)),JSON.stringify(sampleCrew(oneStep,40)), 'Seeded jobs must not depend on frame rate')
assert.equal(JSON.stringify(words), before, 'Motion must not mutate source words')
const stopping = sampleCrew(makeCrew(words, 450, 123), 1).poses.find(p => p.phase === 'Carry')
assert.ok(stopping, 'Exercise completion while holding a word')
const lowering = finishPose(stopping, finishFrame(.12, 200), 450)
assert.equal(lowering.x, stopping.x)
assert.equal(lowering.word.x, stopping.word.x)
assert.ok(lowering.word.y > stopping.word.y)
const placed = finishPose(stopping, finishFrame(.24, 200), 450)
assert.equal(placed.word.y, stopping.foot - 10)
assert.equal(placed.grip, 1)
const leaving = finishPose(stopping, finishFrame(.6, 200), 450)
assert.equal(leaving.word.y, placed.word.y)
assert.equal(leaving.grip, 0)
for(const text of ['', 'solo', 'a b', 'x '.repeat(11), 'a verylongidentifier '.repeat(15)]) {
  const edge=makeCrew(layoutWords(text,180,w=>w.length*7),180,42)
  const final=sampleCrew(edge,40)
  assert.equal(final.poses.length,crewCount(text))
  assert.ok(final.tokens.every(w=>Number.isFinite(w.x)&&Number.isFinite(w.y)))
}

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
get('request').clientWidth = 680
get('request').clientHeight = 200
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
assert.equal(get('scene').style.width, '680px', 'Keep the textarea content width, including any scrollbar space')
assert.equal(get('scene').getAttribute('height'), '200', 'Starting the animation must not grow the text box')
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
const beforeSweep = get('words').children.map(el => Number(el.getAttribute('y')))
advance(.95)
const sweepOffsets = get('words').children.map((el,i) => Number(el.getAttribute('y')) - beforeSweep[i])
assert.ok(sweepOffsets[0] > 0)
assert.ok(sweepOffsets.every(offset => Math.abs(offset - sweepOffsets[0]) < 1e-8), 'Completion must move every word by the same distance, never compress the text')
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
console.log('PASS: 24px fixed text lines, 2.5x movement, seeded varied jobs, frame-rate independence, exclusive word reservations, fitted replacements, short/empty input, Unicode preservation, 28px carrying height, hand contact, motion continuity, SVG visibility, and all playback/error-recovery controls. Visual timing still requires owner review.')
