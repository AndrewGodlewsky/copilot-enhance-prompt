import { assert, test } from '#testing'
import { itemLabel } from './view.ts'

test('item names preserve Unicode, normalize only label whitespace and distinguish long duplicate previews', () => {
  assert.equal(itemLabel('rule', 0, '\n  Run\t tests  '), 'rule 1: Run tests')
  assert.equal(itemLabel('model profile', 2, '  '), 'model profile 3: Untitled')
  assert.equal(itemLabel('structure', 0, '工作 🧭 café'), 'structure 1: 工作 🧭 café')
  const source = '🧭'.repeat(100) + 'tail'
  const label = itemLabel('rule', 0, source)
  assert.equal(label, 'rule 1: ' + '🧭'.repeat(96) + '…')
  assert.notEqual(label, itemLabel('rule', 1, source))
  assert.equal(source, '🧭'.repeat(100) + 'tail')
})
