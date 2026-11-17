// Research adapter only: never imported by the plugin. Explicit subscription logins, no API keys.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function subscriptionEnvironment(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !/^(?:ANTHROPIC_|OPENAI_API_KEY$|OPENAI_BASE_URL$|OPENAI_ORG_ID$|OPENAI_PROJECT_ID$|OPENAI_ORGANIZATION$|OPENAI_PROJECT$|CODEX_API_KEY$|CODEX_ACCESS_TOKEN$|CODEX_APP_SERVER_CHATGPT_BASE_URL$|CLAUDE_CODE_OAUTH_TOKEN$|CLAUDE_CODE_USE_|CLAUDE_CODE_EFFORT_LEVEL$|CLAUDE_CODE_MAX_OUTPUT_TOKENS$|CLAUDECODE$)/i.test(key)))
}
function executable(provider) {
  if (!['claude', 'codex'].includes(provider)) throw new Error('Unsupported research provider')
  return process.platform === 'win32' ? execFileSync('where.exe', [`${provider}.exe`], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/)[0] : provider
}
function command(file, args, { cwd, input = '', timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env: subscriptionEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', aborted = ''
    const stop = reason => {
      aborted = reason
      if (process.platform === 'win32' && child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      else child.kill('SIGTERM')
    }
    const timer = setTimeout(() => stop('timeout'), timeoutMs)
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 4_000_000) stop('output_limit') })
    child.stderr.on('data', data => { if (stderr.length < 256_000) stderr += data })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, aborted }) })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  })
}
export async function subscriptionStatus(provider) {
  const file = executable(provider)
  const version = await command(file, ['--version'], { timeoutMs: 15_000 })
  const status = await command(file, provider === 'claude' ? ['auth', 'status', '--json'] : ['login', 'status'], { timeoutMs: 15_000 })
  let allowed = false
  if (provider === 'claude') {
    try {
      const auth = JSON.parse(status.stdout)
      allowed = status.code === 0 && auth.loggedIn === true && auth.authMethod === 'claude.ai' && auth.apiProvider === 'firstParty'
    } catch { /* Fail closed without including raw account diagnostics in an error. */ }
  } else allowed = status.code === 0 && /ChatGPT/i.test(status.stdout + status.stderr) && !/API key/i.test(status.stdout + status.stderr)
  return { allowed, version: version.stdout.trim() || version.stderr.trim() }
}
export async function runSubscription({ provider, model, reasoning, system, user, timeoutMs = 150_000 }) {
  const auth = await subscriptionStatus(provider)
  if (!auth.allowed) throw new Error('Subscription authentication required; API billing is not allowed')
  const directory = await mkdtemp(join(tmpdir(), 'enhance-prompt-eval-'))
  const started = Date.now()
  try {
    let args
    if (provider === 'claude') {
      args = ['--print', '--safe-mode', '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config', '--tools', '', '--disable-slash-commands', '--permission-mode', 'dontAsk', '--output-format', 'json', '--model', model, '--effort', reasoning, '--system-prompt', system]
    } else {
      const instructions = join(directory, 'instructions.txt')
      await writeFile(instructions, system, 'utf8')
      const config = {
        forced_login_method: 'chatgpt', model_provider: 'openai', model_reasoning_effort: reasoning,
        model_instructions_file: instructions, project_doc_max_bytes: 0, developer_instructions: '',
        approval_policy: 'never', web_search: 'disabled', hide_agent_reasoning: true,
        'features.shell_tool': false, 'features.unified_exec': false, 'features.apps': false,
        'features.plugins': false, 'features.multi_agent': false, 'features.skill_search': false,
        'features.view_image': false, 'features.image_generation': false
      }
      args = ['exec', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '--json', '--model', model,
        ...Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]), '-']
    }
    const result = await command(executable(provider), args, { cwd: directory, input: user, timeoutMs })
    const durationMs = Date.now() - started
    if (result.aborted) return { status: result.aborted, durationMs, cliVersion: auth.version }
    if (provider === 'claude') {
      let response
      try { response = JSON.parse(result.stdout) } catch { return { status: 'invalid_response', durationMs, cliVersion: auth.version } }
      const actualModels = Object.keys(response.modelUsage ?? {})
      return { status: result.code === 0 && !response.is_error ? 'ok' : 'failed', durationMs, cliVersion: auth.version,
        actualModels, output: response.result ?? '', usage: response.usage, modelUsage: response.modelUsage,
        // CLI estimates are not an invoice and do not establish subscription dollars charged.
        estimatedApiCostUsd: response.total_cost_usd, subtype: response.subtype }
    }
    const events = result.stdout.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
    const messages = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message')
    const toolEvents = events.filter(event => /^item\./.test(event.type) && event.item && !['agent_message', 'reasoning'].includes(event.item.type))
    return { status: result.code === 0 && messages.length && !toolEvents.length ? 'ok' : 'failed', durationMs, cliVersion: auth.version,
      actualModels: [], modelVerification: 'requested model; JSONL does not attest resolved model',
      output: messages.at(-1)?.item?.text ?? '', usage: events.find(event => event.type === 'turn.completed')?.usage,
      toolEventCount: toolEvents.length,
      error: events.filter(event => event.type === 'error' || event.type === 'turn.failed').map(event => event.message ?? event.error?.message ?? 'turn failed').join('; ').slice(0, 1000) }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
