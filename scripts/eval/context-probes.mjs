// Offline synthetic observations, not quality scores or regression expectations.
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { weightedKeywords } from '../../src/context/relevance.ts'
import { readText, snippet } from '../../src/context/files.ts'
import { fitBudget } from '../../src/context/index.ts'
import { VERSION } from '../../src/version.ts'

export async function runContextProbes() {
  const requests = [
    { language: 'en', request: 'Fix the login button' },
    { language: 'zh-Hans', request: '修复登录按钮' },
    { language: 'ja', request: 'ログインボタンを修正' },
    { language: 'vi', request: 'Sửa nút đăng nhập' },
    { language: 'en', request: 'Fix src/auth/session.ts' },
    { language: 'zh-Hans', request: '修复 src/auth/session.ts 中的登录按钮' }
  ]
  const lineCount = 150, paddingCharacters = 260, hitLines = [50, 100], snippetBudget = 1400
  const source = Array.from({ length: lineCount }, (_, index) => `line ${index + 1} ${'x'.repeat(paddingCharacters)}`).join('\n')
  const directory = await mkdtemp(join(tmpdir(), 'enhance-context-probes-'))
  const path = join(directory, 'long-lines.txt')
  let excerpt
  try {
    await writeFile(path, source, 'utf8')
    const loaded = await readText(directory, 'long-lines.txt')
    if (loaded !== source) throw new Error('Synthetic snippet fixture could not be read intact')
    excerpt = snippet(loaded, hitLines, snippetBudget)
  } finally {
    // Delete only the fixture and exact directory this call created; never recurse.
    await rm(path, { force: true })
    await rmdir(directory)
  }
  const visibleLines = [...excerpt.matchAll(/^(\d+):/gm)].map(match => Number(match[1]))
  const budget = 1500
  const items = [{ kind: 'rules', chars: 900 }, { kind: 'file', chars: 1000 }]
    .map(({ kind, chars }) => ({ id: kind, kind, label: kind, content: 'x'.repeat(chars), chars }))
  const fitted = fitBudget(items, budget)
  const totalCharacters = fitted.reduce((sum, item) => sum + item.content.length, 0)
  return {
    schemaVersion: 1,
    suite: 'context-pipeline-offline',
    pluginVersion: VERSION,
    inferenceCalls: 0,
    probes: [
      {
        id: 'keyword-languages', source: 'src/context/relevance.ts:weightedKeywords',
        fixture: { requests },
        observation: { cases: requests.map(input => ({ ...input, keywords: weightedKeywords(input.request) })) }
      },
      {
        id: 'late-hit-snippet', source: 'src/context/files.ts:snippet',
        fixture: { lineCount, paddingCharacters, lineTemplate: 'line {1-based index} {x repeated paddingCharacters}', hitLines, budget: snippetBudget, inputCharacters: source.length },
        observation: { visibleLines, hitVisibility: hitLines.map(line => ({ line, visible: visibleLines.includes(line) })), outputCharacters: excerpt.length, excerpt }
      },
      {
        id: 'budget-marker-overage', source: 'src/context/index.ts:fitBudget',
        fixture: { budget, items: items.map(({ id, kind, chars }) => ({ id, kind, chars })), fillCharacter: 'x' },
        observation: { totalCharacters, overage: Math.max(0, totalCharacters - budget), items: fitted.map(({ id, chars, content, note }) => ({ id, reportedCharacters: chars, actualCharacters: content.length, ...(note ? { note } : {}) })) }
      }
    ]
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runContextProbes().then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n'))
    .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
}
