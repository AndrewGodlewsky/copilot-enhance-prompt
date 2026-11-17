import test from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionEnvironment } from './subscription-models.mjs'

test('subscription environment removes API credentials, provider overrides, and inherited effort', () => {
  const blocked = [
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL',
    'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CODEX_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
    'CLAUDE_CODE_EFFORT_LEVEL', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'CLAUDECODE'
  ]
  const source = Object.fromEntries(blocked.flatMap(key => [[key, 'fixture'], [key.toLowerCase(), 'fixture']]))
  assert.deepEqual(subscriptionEnvironment(source), {})
})

test('subscription environment preserves OS discovery, network trust, and required monitoring', () => {
  const source = {
    Path: 'fixture-path', PATHEXT: '.EXE', SystemRoot: 'C:\\Windows',
    USERPROFILE: 'C:\\Users\\fixture', APPDATA: 'fixture-appdata', LOCALAPPDATA: 'fixture-local',
    HOME: '/fixture-home', TEMP: 'fixture-temp', TMP: 'fixture-tmp',
    HTTPS_PROXY: 'https://proxy.invalid', NO_PROXY: 'localhost', NODE_EXTRA_CA_CERTS: 'fixture-ca.pem',
    CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_EXPORTER_OTLP_ENDPOINT: 'https://telemetry.invalid'
  }
  assert.deepEqual(subscriptionEnvironment(source), source)
})

test('subscription environment does not mutate its caller environment', () => {
  const source = Object.freeze({ OPENAI_API_KEY: 'fixture', USERPROFILE: 'fixture-home' })
  assert.deepEqual(subscriptionEnvironment(source), { USERPROFILE: 'fixture-home' })
  assert.equal(source.OPENAI_API_KEY, 'fixture')
})

test('subscription environment removes alternate Codex credentials and provider account headers', () => {
  const source = {
    CODEX_ACCESS_TOKEN: 'fixture',
    CODEX_APP_SERVER_CHATGPT_BASE_URL: 'https://route.invalid',
    OPENAI_ORGANIZATION: 'fixture-organization',
    OPENAI_PROJECT: 'fixture-project'
  }
  assert.deepEqual(subscriptionEnvironment(source), {})
})
