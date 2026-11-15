import { existsSync, readFileSync } from 'node:fs'
import { assert, test } from '#testing'

test('the plugin uses the Agent Plugins manifest and a stable canvas identity', () => {
  const manifest = JSON.parse(readFileSync(new URL('../plugin.json', import.meta.url), 'utf8'))
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
  assert.equal(manifest.name, 'enhance-prompt')
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
  assert.equal(manifest.execution, undefined)
  assert.equal(manifest.capabilities, undefined)
  assert.equal(existsSync(new URL('../com.github.copilot/hooks', import.meta.url)), false, 'The installed package must not register retired chat hooks')
})
