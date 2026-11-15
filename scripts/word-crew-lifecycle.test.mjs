import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'

// A synchronous hook harness, not a browser. Exercise the production hook's ownership and cleanup
// separately from SVG rendering (word-crew.test.mjs) and native layout (manual visual check).
const hooks = `
  let slots=[], index=0, pending=[], changed=false;
  export const refs=[];
  export function useRef(value) {
    const i=index++;
    if(!slots[i]) { slots[i]={current: refs.shift() ?? value}; }
    return slots[i];
  }
  export function useState(value) {
    const i=index++;
    if(!(i in slots)) slots[i]=typeof value==='function'?value():value;
    return [slots[i], next=>{ const v=typeof next==='function'?next(slots[i]):next; if(v!==slots[i]){slots[i]=v;changed=true;} }];
  }
  export function useLayoutEffect(effect,deps) {
    const i=index++, old=slots[i];
    if(!old || deps.some((d,j)=>!Object.is(d,old.deps[j]))) pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:effect()};});
  }
  export function renderHook(render) {
    let result, attempts=0;
    do { changed=false; index=0; result=render(); const effects=pending;pending=[];effects.forEach(f=>f()); if(++attempts>15)throw Error('render loop'); } while(changed);
    return result;
  }
  export function unmount(){ slots.forEach(s=>s?.cleanup?.());slots=[]; }
`

test('real run status governs success, cancellation, original content, reduced motion and disposal', async () => {
  const compiled = await build({
    stdin: { contents: `
      import { useWordCrew } from './web/src/use-word-crew.ts'
      export { refs, unmount } from 'react'
      import { renderHook } from 'react'
      export { mounts, measurement } from './web/src/word-crew'
      export const render = (...args) => renderHook(() => useWordCrew(...args))
    `, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{ name: 'hook-test', setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'mock' }))
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: hooks }))
      b.onLoad({ filter: /web[\\/]src[\\/]word-crew\.ts$/ }, () => ({ contents: `
        export const mounts=[];
        export const measurement={valid:true,throws:false};
        export function measureWords(){if(measurement.throws)throw Error('layout unavailable'); return measurement.valid?[{text:'word',x:1,y:1,width:10}]:null;}
        export function mountWordCrew(svg,words,width,height,settled){
          const crew={retired:0,finished:0,disposed:0,paused:false,settled,retire(){this.retired++},finish(){this.finished++},dispose(){this.disposed++},pause(v){this.paused=v}};
          mounts.push(crew);return crew;
        }
      ` }))
    } }]
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const api = module.exports
  const saved = Object.fromEntries(['window', 'document', 'ResizeObserver', 'getComputedStyle'].map(k => [k, globalThis[k]]))
  const listeners = new Map(), media = { matches: false, addEventListener: (_, fn) => listeners.set('motion', fn), removeEventListener: () => listeners.delete('motion') }
  let observer
  globalThis.window = { matchMedia: () => media }
  globalThis.document = { hidden: false, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) }
  globalThis.ResizeObserver = class { constructor(fn) { observer = this; this.fn = fn } observe() {} disconnect() { this.disconnected = true } }
  globalThis.getComputedStyle = () => ({ fontSize: '14px', fontFamily: 'sans-serif', fontWeight: '400', fontStyle: 'normal' })
  const source = '  Original café\n路径 <script> "quoted"  '
  const input = { value: source, clientWidth: 400, clientHeight: 112, clientLeft: 1, clientTop: 1, scrollTop: 200, scrollLeft: 0, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) }
  const base = { runId: 'one', prompt: source.trim(), workspace: { key: 'project' }, status: 'running' }
  try {
    api.refs.push(input, { style: {} })
    let state = api.render(base, source, 'project')
    assert.equal(state.visible, true)
    assert.equal(state.finishing, false)
    listeners.get('scroll')()
    assert.equal(api.render(base, source, 'project').visible, true, 'a queued scroll event at the measured position does not hide the crew')
    state.togglePause()
    assert.equal(api.mounts[0].paused, true)
    state = api.render({ ...base, status: 'done' }, source, 'project')
    assert.equal(state.finishing, true)
    assert.equal(api.mounts[0].finished, 1)
    assert.equal(api.mounts.length, 1, 'success finishes the existing crew')
    api.mounts[0].settled()
    state = api.render({ ...base, status: 'done' }, source, 'project')
    assert.equal(state.visible, false)
    assert.equal(state.finishing, false)
    assert.equal(input.value, source, 'no restoration write or trimming')
    const slow = { ...base, runId: 'slow' }
    state = api.render(slow, source, 'project', 94)
    const retiringCrew = api.mounts.at(-1)
    assert.equal(retiringCrew.retired, 0)
    state.togglePause()
    state = api.render(slow, source, 'project', 95)
    assert.equal(retiringCrew.retired, 1)
    assert.equal(retiringCrew.finished, 0)
    assert.equal(state.visible, true)
    assert.equal(state.retiring, true)
    assert.equal(state.paused, false)
    assert.equal(state.finishing, false, 'the result is still pending')
    state = api.render(slow, source, 'project', 90)
    assert.equal(state.retiring, true, 'a progress correction cannot restart the crew')
    state = api.render({ ...slow, status: 'done' }, source, 'project', 100)
    assert.equal(retiringCrew.finished, 1)
    assert.equal(state.finishing, true)
    api.render({ ...base, runId: 'already-95' }, source, 'project', 95)
    assert.equal(api.mounts.at(-1).retired, 1, 'a new run already past the threshold retires its own crew')
    for (const outcome of ['error', 'cancelled']) {
      const run = { ...base, runId: outcome }
      api.render(run, source, 'project', 95)
      const crew = api.mounts.at(-1)
      state = api.render({ ...run, status: outcome }, source, 'project')
      assert.equal(state.visible, false)
      assert.equal(crew.finished, 0)
      assert.ok(crew.disposed)
    }
    api.render({ ...base, runId: 'changed' }, source, 'project')
    state = api.render({ ...base, runId: 'changed', status: 'done' }, 'A newer draft', 'project')
    assert.equal(state.visible, false, 'never conceal or overwrite a newer draft')
    assert.equal(input.value, source)
    state = api.render({ ...base, runId: 'elsewhere' }, source, 'another project')
    assert.equal(state.visible, false)
    media.matches = true; listeners.get('motion')()
    state = api.render({ ...base, runId: 'reduced' }, source, 'project')
    assert.equal(state.visible, false)
    media.matches = false; listeners.get('motion')()
    const scrolling = { ...base, runId: 'scrolling' }
    api.render(scrolling, source, 'project')
    input.scrollTop += 20; listeners.get('scroll')()
    assert.equal(api.render(scrolling, source, 'project').visible, false, 'a changed viewport reveals native text instead of misaligned artwork')
    assert.equal(input.value, source)
    api.render({ ...base, runId: 'resizing' }, source, 'project')
    input.clientWidth = 300; observer.fn()
    assert.equal(api.render({ ...base, runId: 'resizing' }, source, 'project').visible, false)
    api.measurement.throws = true
    assert.equal(api.render({ ...base, runId: 'layout-error' }, source, 'project').visible, false)
    api.measurement.throws = false
    api.render({ ...base, runId: 'closing' }, source, 'project')
    const last = api.mounts.at(-1)
    api.unmount()
    assert.ok(last.disposed)
    assert.equal(listeners.size, 0)
    assert.ok(observer.disconnected)
  } finally {
    api.unmount()
    Object.assign(globalThis, saved)
  }
})
