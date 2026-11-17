// Read-only, shareable metrics. Never serialize prompts, outputs, reviewer reasons or protocol data.
import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarize } from './summarize.mjs'

const tiers = ['low', 'medium', 'high']
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const number = (value, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : '—'
const seconds = value => Number.isFinite(value) ? value / 1000 : null
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null
}
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.+-]+$/.test(value)) throw new Error('A report identifier is not a shareable label')
  return value
}
const key = row => `${id(row.caseId)}/${id(row.tier)}`
const score = row => row?.status === 'ok' && Number.isFinite(row.score) ? row.score : null
const reviews = row => row?.reviews ?? []
const flaggers = row => reviews(row).filter(review => review.hardFailures.length > 0).length
const union = row => flaggers(row) > 0
const unanimous = row => reviews(row).length > 1 && flaggers(row) === reviews(row).length
const timeout = row => /timeout|timed_out/.test(row.status)
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`)
].join('\n')

function indexRows(rows) {
  const index = new Map()
  for (const row of rows) {
    const identity = key(row)
    if (index.has(identity)) throw new Error('Ambiguous duplicate case/tier in a report condition')
    index.set(identity, row)
  }
  return index
}

export function compareRows(baseline, treatment) {
  const a = indexRows(baseline), b = indexRows(treatment)
  return [...new Set([...a.keys(), ...b.keys()])].sort().map(identity => {
    const left = a.get(identity), right = b.get(identity)
    const leftScore = score(left), rightScore = score(right)
    const comparable = leftScore !== null && rightScore !== null
    return { identity, baseline: left, treatment: right, comparable,
      delta: comparable ? rightScore - leftScore : null,
      newHardFailure: comparable ? union(right) && !union(left) : null }
  })
}

function metrics(row) {
  if (!row) return '—'
  return `\`${id(row.id)}\`<br>${id(row.status)} · ${number(score(row), 2)} · ${number(seconds(row.ms), 1)} · ${number(row.words)}`
}

function hardVotes(row) {
  return row?.status === 'ok' && reviews(row).length ? `${flaggers(row)}/${reviews(row).length}` : '—'
}

function matrix(title, conditions) {
  const indexes = conditions.map(condition => indexRows(condition.rows))
  const identities = [...new Set(indexes.flatMap(index => [...index.keys()]))]
    .sort((a, b) => a.split('/')[0].localeCompare(b.split('/')[0]) || tiers.indexOf(a.split('/')[1]) - tiers.indexOf(b.split('/')[1]))
  if (!identities.length) return `## ${title}\n\nNo matching generations recorded.\n`
  const includeDelta = conditions.length === 2
  const headers = ['Case / tier', ...conditions.map(condition => `${condition.label}: ID; status · score · s · words`),
    ...(includeDelta ? ['Δ score'] : []), ...conditions.map(condition => `${condition.label}: hard votes`)]
  const body = identities.map(identity => {
    const selected = indexes.map(index => index.get(identity))
    const scores = selected.map(score)
    return [identity, ...selected.map(metrics), ...(includeDelta ? [number(scores.every(value => value !== null) ? scores[1] - scores[0] : null, 2)] : []),
      ...selected.map(hardVotes)]
  })
  const comparisons = []
  for (const treatment of conditions.slice(1)) {
    for (const tier of tiers.filter(value => treatment.rows.some(row => row.tier === value))) {
      const pairs = compareRows(conditions[0].rows.filter(row => row.tier === tier), treatment.rows.filter(row => row.tier === tier))
      const comparable = pairs.filter(pair => pair.comparable)
      comparisons.push([`${conditions[0].label} → ${treatment.label} / ${tier}`, pairs.length, comparable.length,
        comparable.filter(pair => pair.delta > 0).length, comparable.filter(pair => pair.delta === 0).length,
        comparable.filter(pair => pair.delta < 0).length, number(mean(comparable.map(pair => pair.delta)), 2),
        comparable.length ? comparable.filter(pair => pair.newHardFailure).length : '—'])
    }
  }
  return `## ${title}\n\n${table(headers, body)}\n\n${table(
    ['Comparison / tier', 'Case pairs', 'Scored pairs', 'Wins', 'Ties', 'Losses', 'Mean Δ', 'New union hard flags'], comparisons)}\n`
}

function groupMetrics(rows) {
  const ok = rows.filter(row => row.status === 'ok')
  const assessed = ok.filter(row => score(row) !== null)
  return [rows.filter(row => row.status !== 'planned').length, rows.filter(row => row.status === 'planned').length,
    ok.length, `${assessed.length} / ${ok.filter(row => reviews(row).length > 1).length}`,
    number(mean(assessed.map(score)), 2), assessed.length ? `${assessed.filter(union).length} / ${assessed.filter(unanimous).length}` : '—',
    ok.some(row => row.literalFailure !== null && row.literalFailure !== undefined) ? ok.filter(row => row.literalFailure).length : '—',
    number(seconds(median(ok.map(row => row.ms))), 1), number(median(ok.map(row => row.words)), 1),
    number(median(ok.map(row => row.inputCharacters)), 1)]
}

export function renderReport(summary) {
  const { rows } = summary
  const phase = name => rows.filter(row => row.phase === name)
  const baseline = phase('baseline')
  const context = phase('context')
  const contextCases = new Set(context.map(row => row.caseId))
  const reasoning = phase('reasoning'), reasoningHigh = phase('reasoning-high')
  const reasoningKeys = new Set([...reasoning, ...reasoningHigh].map(key))
  const guard = phase('guard'), guardKeys = new Set(guard.map(key))
  const attempted = rows.filter(row => row.status !== 'planned')
  const ok = rows.filter(row => row.status === 'ok')
  const assessed = ok.filter(row => score(row) !== null)
  const unsuccessful = attempted.filter(row => row.status !== 'ok')
  const groups = new Map()
  for (const row of rows) {
    const identity = [row.phase, row.tier, row.candidate, row.context, row.config.reasoning].map(id).join('/')
    if (!groups.has(identity)) groups.set(identity, [])
    groups.get(identity).push(row)
  }
  const configurations = new Map()
  for (const row of rows) {
    const identity = [row.tier, row.config.model, row.config.reasoning].map(id).join('/')
    configurations.set(identity, row.config.proxyFor ? id(row.config.proxyFor) : '—')
  }
  const sections = [
    '# Prompt rewriting evaluation: results appendix',
    'This appendix contains numeric evidence and generation identifiers only. Scores are the mean of recorded reviewer totals across four 0–2 dimensions (0–8 overall). A dash means missing, unsuccessful or unreviewed; a real zero remains zero. Successful outputs with only one review are included and are visible in the hard-vote denominator.',
    `The ledger contains **${rows.length} planned entries**, **${attempted.length} attempted generations**, **${ok.length} successful generations**, **${unsuccessful.length} unsuccessful or interrupted attempts** (${unsuccessful.filter(timeout).length} timeouts), and **${rows.length - attempted.length} unstarted entries**. Review coverage is **${assessed.length}/${ok.length} successful generations** with at least one score and **${ok.filter(row => reviews(row).length > 1).length}/${ok.length}** with at least two reviews; **${ok.reduce((sum, row) => sum + reviews(row).length, 0)} assessments** in total.`,
    `Among reviewed successful generations, union hard flags affect **${assessed.filter(union).length}/${assessed.length}** and unanimous hard flags affect **${assessed.filter(unanimous).length}/${ok.filter(row => reviews(row).length > 1).length}**. Union means at least one reviewer flagged the output. Unanimous requires at least two reviews and every reviewer flagging the output; it does not require the same failure category.`,
    'Attempt counts are ledger generation attempts, not an invoice or a count of provider HTTP requests. Preflight failures and interrupted runs can count as attempts; retries inside a CLI can make more than one provider request. Separately recorded smoke probes are excluded. Reused baseline rows in later tables are not additional calls.',
    '## Requested configurations',
    table(['Tier / requested model / effort', 'Proxy for'], [...configurations].sort(([a], [b]) => a.localeCompare(b))),
    'These are requested model configurations. Medium uses GPT-6 Sol as a proxy for GPT-6.1 Sol. Claude responses supply model-usage identifiers; the Codex JSONL output does not attest the resolved model. Subscription authentication does not establish zero additional charges if overage or credits are enabled.',
    '## Coverage and aggregate metrics',
    'Group identifiers are deterministic phase / tier / candidate / context / requested effort tuples. Reviews shows generations with at least one / at least two reviews. Hard U/A shows union / unanimous flagged generations. Literal flags are automated checks, separate from reviewer hard flags. Score means exclude unsuccessful and unreviewed generations; medians use successful generations with recorded measurements.',
    table(['Group tuple', 'Attempts', 'Unstarted', 'OK', 'Reviews ≥1 / ≥2', 'Mean score /8', 'Hard U/A', 'Literal flags', 'Median s', 'Median words', 'Median input chars'],
      [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([identity, group]) => [identity, ...groupMetrics(group)])),
    '## Non-successful and unstarted entries',
    rows.some(row => row.status !== 'ok') ? table(['Generation', 'Phase / case / tier', 'Status', 'Elapsed s'], rows.filter(row => row.status !== 'ok').map(row =>
      [`\`${id(row.id)}\``, [row.phase, row.caseId, row.tier].map(id).join('/'), id(row.status), number(seconds(row.ms), 1)])) : 'None recorded.',
    '## Reading the comparison tables',
    'Each metric cell contains the generation ID, then status · score /8 · elapsed seconds · output words. Hard votes are flagging reviewers / all reviewers and are separate from scores. A timeout may retain measured time or partial-output length without receiving a quality score. Deltas and win/tie/loss counts require both generations to be successful and reviewed. A missing or failed side never becomes a zero or a loss. New union hard flags count only comparable reviewed pairs.',
    matrix('Baseline versus compact prompt', [{ label: 'Baseline', rows: baseline }, { label: 'Compact', rows: phase('compact') }]),
    matrix('Baseline versus open-choice guard', [{ label: 'Baseline', rows: baseline.filter(row => guardKeys.has(key(row))) }, { label: 'Guard', rows: guard }]),
    matrix('Project context variants', [
      { label: 'Relevant (baseline reused)', rows: baseline.filter(row => contextCases.has(row.caseId)) },
      { label: 'Off', rows: context.filter(row => row.context === 'off') },
      { label: 'Overview', rows: context.filter(row => row.context === 'overview') },
      { label: 'Noisy', rows: context.filter(row => row.context === 'noisy') }
    ]),
    matrix('Reasoning effort within the same model', [
      { label: 'Baseline effort', rows: baseline.filter(row => reasoningKeys.has(key(row))) },
      { label: 'Lower effort', rows: reasoning },
      ...(reasoningHigh.length ? [{ label: 'Haiku high effort', rows: reasoningHigh }] : [])
    ]),
    matrix('Holdout baseline versus selected treatment', [{ label: 'Holdout baseline', rows: phase('holdout-baseline') }, { label: 'Holdout treatment', rows: phase('holdout-treatment') }]),
    '## Limits of these measurements',
    'These are descriptive results from a small synthetic corpus, with one generation per recorded configuration and no confidence or statistical-significance claim. Reviewer votes measure rewriting quality, not downstream coding success. Reviewer disagreement and unreviewed outputs remain visible. Tuning choices were selected after seeing tuning results; holdout comparisons should be interpreted separately.',
    'Latency includes CLI startup and service conditions, and concurrent execution can affect it. Input characters and output words are size measures, not token charges. Provider usage formats and caching differ; this appendix does not infer missing token counts or costs. Subscription CLIs, wrapper prompts, managed policies and telemetry differ from the production Copilot runtime, so these results are indirect evidence for production behavior.'
  ]
  return sections.join('\n\n') + '\n'
}

export function readReport(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true })
  try { return renderReport(summarize(db)) } finally { db.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: node scripts/eval/report.mjs LEDGER_DIRECTORY\n')
    process.exitCode = 1
  } else {
    try { process.stdout.write(readReport(resolve(process.argv[2], 'results.sqlite'))) }
    catch { process.stderr.write('Could not render the read-only ledger; check its schema and unique shareable identifiers.\n'); process.exitCode = 1 }
  }
}
