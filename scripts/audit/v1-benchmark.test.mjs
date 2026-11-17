import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticHistory, groupedProjects, summarize } from './v1-benchmark.mjs'
import { historyProjects } from '../../src/panel/history.ts'

test('audit grouping prototype preserves counts, ordering, Unicode and path identity', () => {
  const entries = syntheticHistory(1200, 40)
  entries.push({ ...entries[0], id: 'unassigned', project: undefined }, { ...entries[0], id: 'unicode', project: 'C:\\synthetic\\原文' })
  for (const query of ['', 'module 2', 'absent', 'SYNTHETIC']) for (const current of [null, '/synthetic/team-0/project-0', '/new/project-0']) {
    assert.deepEqual(groupedProjects(entries, current, query), historyProjects(entries, current, query))
  }
})

test('audit summaries retain measured samples and reject invalid measurements', () => {
  assert.deepEqual(summarize([4, 1, 2]), { samples: [4, 1, 2], medianMs: 2, maxMs: 4, minMs: 1 })
  assert.throws(() => summarize([])); assert.throws(() => summarize([NaN])); assert.throws(() => summarize([-1]))
})
