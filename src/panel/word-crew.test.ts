import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCrew, sampleCrew, finishFrame, body, type Word } from './word-crew.ts'

const words: Word[] = Array.from({ length: 31 }, (_, i) => ({ text: ['café', '路径', 'getUser()', '🧑‍💻'][i % 4], width: 60, x: 12 + (i % 7) * 72, y: 20 + Math.floor(i / 7) * 20 }))

test('the completion sweep moves the entire paragraph together, offscreen, without compression', () => {
  const before = structuredClone(words)
  for (const seconds of [.6, .7, .9, 1.1, 1.25]) {
    const frame = finishFrame(seconds, 200)
    const shifted = words.map(w => ({ ...w, y: w.y + frame.offset }))
    for (let i = 1; i < words.length; i++) assert.ok(Math.abs((shifted[i].y - shifted[0].y) - (words[i].y - words[0].y)) < 1e-9)
    assert.equal(frame.barY, frame.offset)
  }
  assert.equal(finishFrame(.5, 200).offset, 0, 'crew leaves before the sweep')
  assert.ok(finishFrame(1.25, 200).offset >= 200)
  assert.equal(finishFrame(1.25, 200).done, true)
  assert.deepEqual(words, before)
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
