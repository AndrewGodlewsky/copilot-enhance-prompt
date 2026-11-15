// Decorative positions only: this module never reads or writes the user's draft.
export type Point = { x: number; y: number }
export type Word = Point & { text: string; width: number }
export type Token = Word & { opacity: number }
type Slot = Point & { capacity: number; word: { text: string; width: number } }
type Job = {
  from: number; to: number; start: Point; end: Point; entry: Point; startedAt: number
  approach: number; carry: number; word: Slot['word']; filler: Slot['word']; direction: number; endsAt: number
}
type Actor = { job: Job | null; position: Point | null; recent: number[]; lastTarget: number; lastWord: Slot['word'] | null }
type Crew = { slots: Slot[]; vocabulary: Slot['word'][]; actors: Actor[]; bag: number[]; random: () => number; width: number; completed: number }
export type Pose = { x: number; foot: number; word: Point; grip: number; crouch: number; walk: number; phase: string; carrying: boolean; kick: number; clear: number; fill: number; visible?: boolean }
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const ease = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t) }
const point = (a: Point, b: Point, t: number) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) })
const LINE_HEIGHT = 24, MOTION_SPEED = 2.5
function seededRandom(seed: number) {
  let state = (seed >>> 0) || 0x6d2b79f5
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
}
function shuffle<T>(values: T[], random: () => number) {
  const result = [...values]
  for (let i = result.length - 1;i > 0;i--) { const j = Math.floor(random() * (i + 1));[result[i], result[j]] = [result[j], result[i]] }
  return result
}
const pick = <T>(values: T[], random: () => number) => values[Math.floor(random() * values.length)]
const center = (slot: Slot) => ({ x: slot.x + slot.capacity / 2, y: slot.y })
function assignJob(crew: Crew, actor: Actor, startedAt: number) {
  const reserved = new Set(crew.actors.flatMap(a => a.job ? [a.job.from, a.job.to] : []))
  const available = crew.slots.map((_, i) => i).filter(i => !reserved.has(i))
  const sources = available.filter(i => i !== actor.lastTarget && crew.slots[i].word !== actor.lastWord)
  if (!sources.length) return
  let candidates = sources.filter(i => available.some(j => i !== j && crew.slots[j].capacity >= crew.slots[i].word.width))
  if (!candidates.length) candidates = sources
  const fresh = candidates.filter(i => !actor.recent.includes(i))
  if (fresh.length) candidates = fresh
  let bagIndex = crew.bag.findIndex(i => candidates.includes(i))
  if (bagIndex < 0) { crew.bag = shuffle(candidates, crew.random); bagIndex = 0 }
  const from = crew.bag.splice(bagIndex, 1)[0]
  const source = crew.slots[from]
  let targets = available.filter(i => i !== from && crew.slots[i].capacity >= source.word.width)
  const changed = targets.filter(i => i !== actor.lastTarget)
  if (changed.length) targets = changed
  const similar = targets.filter(i => crew.slots[i].capacity <= source.word.width * 1.4)
  if (similar.length) targets = similar
  const nearby = targets.filter(i => Math.abs(crew.slots[i].y - source.y) <= LINE_HEIGHT * 2)
  if (nearby.length) targets = nearby
  const to = targets.length ? pick(targets, crew.random) : from
  const destination = crew.slots[to]
  const start = center(source), end = center(destination)
  const entry = actor.position || { x: start.x < crew.width / 2 ? -20 : crew.width + 20, y: start.y }
  const fillers = crew.vocabulary.filter(w => w.width <= source.capacity && w.text !== source.word.text)
  const snug = fillers.filter(w => w.width >= source.capacity * .7)
  const filler = snug.length ? pick(snug, crew.random) : fillers.length ? pick(fillers, crew.random) : source.word
  const approach = Math.max(.25, Math.hypot(start.x - entry.x, start.y - entry.y) / 115)
  const carry = Math.max(.6, Math.hypot(end.x - start.x, end.y - start.y) / 48)
  // A replacement is a new word instance, even when its text has appeared before.
  actor.job = {
from, to, start, end, entry, startedAt, approach, carry, word: source.word, filler: { ...filler }, direction: crew.random() < .5 ? -1 : 1,
    endsAt: startedAt + (approach + .35 + .45 + carry + .4 + .5 + .3 + .2) / MOTION_SPEED
}
  actor.recent = [from, ...actor.recent].slice(0, 3); actor.lastTarget = to
}
export function makeCrew(words: Word[], width: number, seed: number): Crew {
  const crew: Crew = {
slots: words.map(w => ({ x: w.x, y: w.y, capacity: w.width, word: { text: w.text, width: w.width } })),
    vocabulary: words.map(w => ({ text: w.text, width: w.width })), actors: [], bag: [], random: seededRandom(seed), width, completed: 0
}
  // Keep the previous maximum crew size without hiding text in a wide viewport.
  for (let i = 0;i < Math.min(16, Math.ceil(words.length / 10));i++) {
    const actor: Actor = { job: null, position: null, recent: [], lastTarget: -1, lastWord: null }; crew.actors.push(actor); assignJob(crew, actor, i * .08)
  }
  return crew
}
function advanceCrew(crew: Crew, time: number) {
  // Process exact finish times, so the seeded choices don't depend on frame rate.
  while (true) {
    const actor = crew.actors.reduce<Actor | null>((first, a) => a.job && (!first || a.job.endsAt < first.job!.endsAt) ? a : first, null)
    if (!actor || actor.job!.endsAt > time) break
    const job = actor.job!
    crew.slots[job.from].word = job.filler; crew.slots[job.to].word = job.word
    actor.position = job.end; actor.lastWord = job.word; actor.job = null; crew.completed++
    assignJob(crew, actor, job.endsAt)
    for (const waiting of crew.actors) if (!waiting.job && waiting !== actor) assignJob(crew, waiting, job.endsAt)
  }
}
function transport(job: Job, time: number): Pose {
  let t = (time - job.startedAt) * MOTION_SPEED
  const rest = (at: Point, phase: string, walk = 0): Pose => ({ x: at.x, foot: at.y + 10, word: { ...job.start }, grip: 0, crouch: 0, walk, phase, carrying: false, kick: 0, clear: 0, fill: 0 })
  if (t < 0) return { ...rest(job.entry, 'Waiting'), visible: false }
  if (t < job.approach) return rest(point(job.entry, job.start, ease(t / job.approach)), 'Run to a word', Math.sin(t * 19))
  t -= job.approach
  let at = { ...job.start }, lift = 0, grip = 1, crouch = 0, walk = 0, kick = 0, clear = 0, phase, carrying = false
  const fill = ease((t - .35) / .4)
  if (t < .35) { phase = 'Reach'; grip = ease(t / .35); crouch = 3 * grip }
  else if ((t -= .35) < .45) { phase = 'Lift'; const f = ease(t / .45); lift = 16.4 * f; crouch = 3 * (1 - f); carrying = true }
  else if ((t -= .45) < job.carry) { phase = 'Carry'; const f = t / job.carry; at = point(job.start, job.end, ease(f)); at.y += Math.sin(f * Math.PI) * Math.sin(t * 15) * .35; lift = 16.4; walk = Math.sin(t * 15) * Math.sin(f * Math.PI); carrying = true }
  else if ((t -= job.carry) < .4) { phase = 'Make room'; at = { ...job.end }; lift = 16.4; kick = Math.sin(Math.PI * clamp(t / .32)); clear = ease((t - .08) / .32); carrying = true }
  else if ((t -= .4) < .5) { phase = 'Set down'; const f = ease(t / .5); at = { ...job.end }; lift = 16.4 * (1 - f); crouch = 3 * f; clear = 1; carrying = true }
  else if ((t -= .5) < .3) { phase = 'Release'; at = { ...job.end }; grip = 1 - ease(t / .3); crouch = 3 * grip; clear = 1; carrying = true }
  else { phase = 'Next word'; at = { ...job.end }; grip = 0; clear = 1; carrying = true }
  return { x: at.x, foot: at.y + 10, word: { x: at.x, y: at.y - lift }, grip, crouch, walk, phase, carrying, kick: job.from === job.to ? 0 : kick * job.direction, clear, fill }
}
export function sampleCrew(crew: Crew, time: number) {
  advanceCrew(crew, time)
  const tokens = crew.slots.map(s => ({ ...s.word, x: s.x + (s.capacity - s.word.width) / 2, y: s.y, opacity: 1 }))
  const carried: Token[] = [], poses: Pose[] = []
  for (const actor of crew.actors) {
    if (!actor.job) {
      const at = actor.position ?? { x: -20, y: 0 }
      poses.push({ x: at.x, foot: at.y + 10, word: { ...at }, grip: 0, crouch: 0, walk: 0, phase: 'Waiting', carrying: false, kick: 0, clear: 0, fill: 0 })
      carried.push({ text: '', width: 0, ...at, opacity: 0 })
      continue
    }
    const job = actor.job!, p = transport(job, time); poses.push(p)
    carried.push({ ...job.word, x: p.word.x - job.word.width / 2, y: p.word.y, opacity: p.carrying ? 1 : 0 })
    if (p.carrying) {
      const s = crew.slots[job.from]; tokens[job.from] = { ...job.filler, x: s.x + (s.capacity - job.filler.width) / 2, y: s.y, opacity: p.fill }
      if (job.from === job.to) { tokens[job.from].opacity = 0; continue }
      const displaced = tokens[job.to]; displaced.x += job.direction * 42 * p.clear; displaced.y -= Math.sin(Math.PI * p.clear) * 12; displaced.opacity = 1 - p.clear
    }
  }
  return { tokens, carried, poses }
}
function elbow(shoulder: Point, hand: Point, side: number) {
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, d = Math.hypot(dx, dy) || 1
  const bend = Math.sqrt(Math.max(0, 7.2 ** 2 - (d / 2) ** 2))
  return { x: (shoulder.x + hand.x) / 2 + side * Math.abs(dy) / d * bend, y: (shoulder.y + hand.y) / 2 + Math.abs(dx) / d * bend }
}
export function body(pose: Pose) {
  const { x, foot, grip = 0, crouch = 0, walk = 0, word } = pose
  const shoulder = { x, y: foot - 15 + crouch }, hip = { x, y: foot - 8.5 + crouch / 2 }
  const head = { x, y: foot - 21.7 + crouch }
  const hands = [-1, 1].map(side => point({ x: x + side * 7, y: foot - 10 + side * walk * 3 }, { x: word.x + side * 4, y: word.y }, grip))
  const arms = hands.map((hand, i) => [shoulder, elbow(shoulder, hand, i ? 1 : -1), hand])
  const legs = [-1, 1].map(side => [hip, { x: x + side * (2.5 + walk * 2), y: foot - 4 }, { x: x + side * (5 + walk * 2), y: foot - Math.max(0, side * walk) * 2 }])
  if (pose.kick) { const leg = legs[pose.kick > 0 ? 1 : 0]; leg[2] = { x: x + pose.kick * 16, y: foot - Math.abs(pose.kick) * 10 } }
  return { head, shoulder, hip, hands, arms, legs }
}

/** Null readiness holds deposited words; success permits one shared offset after the crew exits. */
export function finishFrame(seconds: number, height: number, readyAfter: number | null = 0) {
  const lower = ease(seconds / .24)
  const release = ease((seconds - .24) / .1)
  const exit = ease((seconds - .34) / .6)
  const sweepAt = readyAfter === null ? Infinity : Math.max(.94, readyAfter)
  const offset = (height + 30) * ease((seconds - sweepAt) / .65)
  const walk = exit > 0 && exit < 1 ? Math.sin((seconds - .34) * 45) : 0
  return { lower, release, exit, walk, offset, barY: offset, sweeping: seconds >= sweepAt, done: seconds >= sweepAt + .65 }
}

/** Lower in place before releasing: the deposited word stays behind as its carrier exits. */
export function finishPose(pose: Pose, frame: ReturnType<typeof finishFrame>, width: number): Pose {
  const destination = pose.x < width / 2 ? -24 : width + 24
  const raised = pose.carrying && pose.word.y < pose.foot - 10
  return {
    ...pose,
    x: mix(pose.x, destination, frame.exit),
    word: { ...pose.word, y: pose.carrying ? mix(pose.word.y, pose.foot - 10, frame.lower) : pose.word.y },
    grip: pose.grip * (1 - frame.release),
    crouch: mix(pose.crouch, raised ? 3 : 0, frame.lower) * (1 - frame.release),
    kick: pose.kick * (1 - frame.lower),
    walk: pose.walk * (1 - frame.lower) + frame.walk,
    visible: pose.visible !== false && frame.exit < 1
  }
}
