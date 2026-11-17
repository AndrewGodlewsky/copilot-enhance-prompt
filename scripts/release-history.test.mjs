import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

// Exercise the dialog's state and bundled-text loader without controlling a browser.
test('version opens all releases; latest view, loading failure and retry preserve the history', async () => {
  const compiled = await build({
    stdin: { contents: `
      import { WhatsNew, parseChangelog } from './web/src/whats-new.tsx'
      import { render } from 'history-test-hooks'
      export { fixture, reset } from 'history-test-hooks'
      export { VERSION } from './src/version.ts'
      export { parseChangelog }
      export const draw = () => render(WhatsNew)
    `, resolveDir: process.cwd() },
    tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', keepNames: true, logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'release-history-harness', setup(b) {
      b.onResolve({ filter: /^history-test-hooks$/ }, () => ({ path: 'hooks', namespace: 'history-test' }))
      b.onLoad({ filter: /.*/, namespace: 'history-test' }, () => ({ contents: `
        let slots=[], index=0, effects=[];
        export const fixture={text:'',fail:false,calls:0};
        export async function readNotes(){fixture.calls++;if(fixture.fail)throw Error('missing chunk');return {default:fixture.text};}
        export function useState(value){const i=index++;if(!(i in slots))slots[i]=value;return [slots[i],next=>{slots[i]=next}];}
        export function useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()}});}
        export function render(fn){index=0;const tree=fn();const pending=effects;effects=[];pending.forEach(fn=>fn());return tree;}
        export function reset(){slots.forEach(slot=>slot?.cleanup?.());slots=[];effects=[];}
      ` }))
      b.onLoad({ filter: /web[\\/]src[\\/]whats-new\.tsx$/ }, async ({ path }) => ({
        contents: `import { readNotes } from 'history-test-hooks'\n` + (await readFile(path, 'utf8'))
          .replace("from 'react'", "from 'history-test-hooks'")
          .replace("import('../../CHANGELOG.md?raw')", 'readNotes()'),
        loader: 'tsx'
      }))
    } }]
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const api = module.exports
  const saved = globalThis.localStorage
  let seen = api.VERSION
  globalThis.localStorage = { getItem: () => seen, setItem: (_, value) => { seen = value } }
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
  const named = (tree, name) => nodes(tree).filter(node => node.type?.name === name)
  const turn = () => new Promise(resolve => setImmediate(resolve))
  const clickVersion = tree => {
    named(tree, 'DialogTrigger')[0].props.children.props.onClick()
    tree.props.onOpenChange(true)
  }
  try {
    api.fixture.text = `# Changes\n\n## [${api.VERSION}] - 2026-11-16\n\n### Added\n- Browse version history.\n\n## [0.11.1] - 2026-11-15\n\n- Choose chat text size.\n`
    assert.deepEqual(api.parseChangelog(api.fixture.text).map(release => release.version), [api.VERSION, '0.11.1'])
    let tree = api.draw()
    assert.equal(tree.props.open, false)
    assert.equal(api.fixture.calls, 0, 'notes stay lazy until opened')
    clickVersion(tree)
    tree = api.draw()
    assert.equal(tree.props.open, true)
    assert.equal(named(tree, 'Segmented')[0].props.value, 'all')
    assert.ok(nodes(tree).some(node => node.props?.role === 'status'))
    await turn()
    tree = api.draw()
    assert.equal(named(tree, 'DialogTitle')[0].props.children, 'Release history')
    assert.deepEqual(named(tree, 'ReleaseBody').map(node => node.props.body), ['### Added\n- Browse version history.', '- Choose chat text size.'])
    named(tree, 'Segmented')[0].props.onChange('new')
    tree = api.draw()
    assert.equal(named(tree, 'ReleaseBody').length, 1)
    assert.equal(named(tree, 'DialogTitle')[0].props.children, `What's new in ${api.VERSION}`)
    tree.props.onOpenChange(false)
    tree = api.draw()
    clickVersion(tree)
    assert.equal(named(api.draw(), 'Segmented')[0].props.value, 'all', 'every footer click opens the full list')
    assert.equal(api.fixture.calls, 1, 'opening again reuses bundled notes')

    api.reset()
    api.fixture.fail = true
    seen = '0.11.1'
    api.draw()
    tree = api.draw()
    assert.equal(tree.props.open, true, 'an upgrade still opens its notes once')
    assert.equal(named(tree, 'Segmented')[0].props.value, 'new')
    await turn()
    tree = api.draw()
    assert.ok(nodes(tree).some(node => node.props?.role === 'alert'))
    api.fixture.fail = false
    named(tree, 'Button').find(node => node.props.children === 'Retry').props.onClick()
    api.draw()
    await turn()
    tree = api.draw()
    assert.equal(named(tree, 'ReleaseBody').length, 1, 'Retry recovers the current release notes')
    assert.equal(seen, api.VERSION)
  } finally { api.reset(); globalThis.localStorage = saved }
})
