import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCrew, sampleCrew, finishFrame, finishPose, body, type Word } from './word-crew.ts'

const words: Word[] = Array.from({ length: 31 }, (_, i) => ({ text: ['café', '路径', 'getUser()', '🧑‍💻'][i % 4], width: 60, x: 12 + (i % 7) * 72, y: 20 + Math.floor(i / 7) * 20 }))

test('each figure leaves its last drop location and chooses a different word for its next job', () => {
  let handoffs = 0
  for (const count of [2, 7, 31, 240]) {
    for (const seed of [1, 2, 123, 456]) {
      const input = Array.from({ length: count }, (_, i) => ({ text: `word${i % 5}`, width: 40 + i % 3 * 10, x: 12 + i % 8 * 72, y: 20 + Math.floor(i / 8) * 20 }))
      const crew = makeCrew(input, 600, seed)
      const completed = new Map<object, number>()
      const previous = new Map<object, { to: number; word: object }>()
      for (let event = 0; event < 200; event++) {
        const before = crew.actors.map(actor => actor.job)
        const active = before.filter(job => job !== null)
        if (!active.length) break
        sampleCrew(crew, Math.min(...active.map(job => job.endsAt)))
        crew.actors.forEach((actor, index) => {
          const old = before[index]
          if (old && old !== actor.job) {
            previous.set(actor, { to: old.to, word: old.word })
            completed.set(old.word, index)
          }
        })
        crew.actors.forEach((actor, index) => {
          const next = actor.job, last = previous.get(actor)
          if (!next || next === before[index] || !last) return
          assert.notEqual(next.from, last.to, `seed ${seed}: actor ${index} must walk away from its last drop`)
          assert.notEqual(next.word, last.word, `seed ${seed}: actor ${index} must not pick up its last carried word again`)
          const owner = completed.get(next.word)
          if (owner !== undefined && owner !== index) handoffs++
        })
      }
    }
  }
  assert.ok(handoffs > 0, 'a different figure may pick up a deposited word')
})

test('a figure with only one word rests after its first job instead of picking it up again', () => {
  const crew = makeCrew(words.slice(0, 1), 200, 1)
  const world = sampleCrew(crew, 60)
  assert.equal(crew.completed, 1)
  assert.equal(world.poses.length, 1)
  assert.equal(world.poses[0].carrying, false)
  assert.equal(world.tokens[0].text, words[0].text)
  assert.equal(world.tokens[0].opacity, 1)
  assert.ok(Number.isFinite(body(world.poses[0]).head.x))
})

test('a dense viewport keeps every visible word with a bounded number of figures', () => {
  const visible = Array.from({ length: 240 }, (_, i) => ({ text: `word${i}`, width: 40, x: (i % 30) * 50, y: 30 + Math.floor(i / 30) * 24 }))
  const original = structuredClone(visible)
  const crew = makeCrew(visible, 1500, 123)
  assert.equal(crew.actors.length, 16)
  assert.equal(sampleCrew(crew, 0).tokens.length, visible.length)
  assert.equal(sampleCrew(crew, 20).tokens.length, visible.length)
  assert.deepEqual(visible, original)
})

test('retirement deposits and releases words before exit, then waits for the actual result', () => {
  const crew = makeCrew(words, 540, 123)
  const pose = sampleCrew(crew, 1).poses.find(p => p.phase === 'Carry')!
  assert.ok(pose)
  for (const seconds of [0, .12, .24, .30, .34]) {
    const frame = finishFrame(seconds, 200, null)
    const p = finishPose(pose, frame, 540)
    assert.equal(frame.exit, 0, 'never run off while putting down or releasing')
    assert.equal(p.x, pose.x)
    assert.equal(frame.sweeping, false)
  }
  const placed = finishPose(pose, finishFrame(.24, 200, null), 540)
  assert.equal(placed.word.y, pose.foot - 10)
  assert.equal(placed.grip, 1)
  for (const seconds of [.6, 1, 60]) {
    const frame = finishFrame(seconds, 200, null)
    const p = finishPose(pose, frame, 540)
    assert.deepEqual(p.word, placed.word, 'deposited words stay in place while carriers exit and wait')
    assert.equal(p.grip, 0)
    assert.equal(frame.offset, 0)
    assert.equal(frame.sweeping, false)
    assert.equal(frame.done, false)
  }
  assert.equal(finishFrame(.5, 200, .1).sweeping, false, 'an early result cannot skip retirement')
  assert.equal(finishFrame(1, 200, .1).sweeping, true)
  assert.equal(finishFrame(60, 200, 60).offset, 0)
  assert.ok(finishFrame(60.3, 200, 60).offset > 0)
  assert.equal(finishFrame(60.7, 200, 60).done, true)
})

test('the completion sweep moves the entire paragraph together, offscreen, without compression', () => {
  const before = structuredClone(words)
  for (const seconds of [.94, 1, 1.2, 1.4, 1.6]) {
    const frame = finishFrame(seconds, 200)
    const shifted = words.map(w => ({ ...w, y: w.y + frame.offset }))
    for (let i = 1; i < words.length; i++) assert.ok(Math.abs((shifted[i].y - shifted[0].y) - (words[i].y - words[0].y)) < 1e-9)
    assert.equal(frame.barY, frame.offset)
  }
  assert.equal(finishFrame(.5, 200).offset, 0, 'crew leaves before the sweep')
  assert.ok(finishFrame(1.6, 200).offset >= 200)
  assert.equal(finishFrame(1.6, 200).done, true)
  assert.deepEqual(words, before)
})

test('completion lowers each held word at its current position, releases it, then exits', () => {
  const crew = makeCrew(words, 540, 123)
  const phases = new Set<string>()
  for (let time = 0; time < 8; time += .025) {
    for (const pose of sampleCrew(crew, time).poses) {
      phases.add(pose.phase)
      const before = structuredClone(pose)
      const atStart = finishPose(pose, finishFrame(0, 200), 540)
      assert.deepEqual(body(atStart), body(pose), 'completion starts from the exact displayed pose')
      const halfway = finishPose(pose, finishFrame(.12, 200), 540)
      assert.equal(halfway.x, pose.x, 'no exit movement during set-down')
      assert.equal(halfway.word.x, pose.word.x, 'do not snap the word to its old destination')
      assert.equal(halfway.grip, pose.grip, 'keep hands on the word until it rests')
      if (pose.phase === 'Next word') assert.equal(halfway.crouch, 0, 'already-deposited words do not trigger another bend to pick them up')
      if (pose.carrying) {
        const groundY = pose.foot - 10
        assert.ok(halfway.word.y >= pose.word.y && halfway.word.y <= groundY + 1e-9)
        const placed = finishPose(pose, finishFrame(.24, 200), 540)
        assert.equal(placed.word.y, groundY)
        if (placed.grip === 1) assert.ok(body(placed).hands.every(hand => hand.y === groundY))
        const released = finishPose(pose, finishFrame(.34, 200), 540)
        assert.equal(released.x, pose.x)
        assert.equal(released.grip, 0)
        const leaving = finishPose(pose, finishFrame(.6, 200), 540)
        assert.deepEqual(leaving.word, placed.word, 'the deposited word stays behind when its carrier leaves')
      }
      const gone = finishPose(pose, finishFrame(1, 200), 540)
      assert.equal(gone.visible, false)
      assert.deepEqual(pose, before, 'finishing must not mutate the captured scene')
    }
  }
  for (const phase of ['Waiting', 'Run to a word', 'Reach', 'Lift', 'Carry', 'Make room', 'Set down', 'Release', 'Next word']) assert.ok(phases.has(phase), phase)
})

test('the crew varies jobs without moving line slots, sharing words or changing source data', () => {
  const before = structuredClone(words)
  const crew = makeCrew(words, 540, 123)
  assert.equal(crew.actors.length, 4)
  const jobs = new Set<string>()
  for (let t = 0; t < 30; t += .025) {
    const world = sampleCrew(crew, t)
    const reserved = new Set<number>()
    for (const actor of crew.actors) {
      const job = actor.job!
      jobs.add(`${job.from}:${job.to}`)
      for (const slot of new Set([job.from, job.to])) {
        assert.ok(!reserved.has(slot))
        reserved.add(slot)
      }
      assert.ok(job.word.width <= crew.slots[job.to].capacity)
    }
    for (const pose of world.poses) {
      const shape = body(pose)
      if (pose.grip === 1) assert.ok(shape.hands.every(hand => hand.y === pose.word.y))
      assert.ok(Number.isFinite(shape.head.x))
    }
    crew.slots.forEach((slot, i) => assert.deepEqual([slot.x, slot.y, slot.capacity], [words[i].x, words[i].y, words[i].width]))
  }
  assert.ok(jobs.size > 10)
  assert.deepEqual(sampleCrew(crew, 30), sampleCrew(makeCrew(words, 540, 123), 30))
  assert.notDeepEqual(sampleCrew(makeCrew(words, 540, 456), 30), sampleCrew(crew, 30))
  assert.deepEqual(words, before)
  assert.deepEqual(sampleCrew(makeCrew([], 200, 1), 10), { tokens: [], carried: [], poses: [] })
  assert.equal(sampleCrew(makeCrew(words.slice(0, 1), 200, 1), 10).poses.length, 1)
})
