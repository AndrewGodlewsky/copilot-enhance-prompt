import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'

test('section loading and explicit retry keep composer atoms, and failures have safe diagnostics', async () => {
  const compiled = await build({stdin:{contents:`
    import React from 'react'; import {renderToString,renderToStaticMarkup} from 'react-dom/server'
    import {RecoverableSection,SectionBoundary} from './web/src/section-recovery.tsx'
    import {CanvasConnectionNotice,setCanvasConnection} from './web/src/canvas-connection.tsx'
    import {panelDiagnostics} from './src/panel/diagnostics.ts'
    import {read,set} from './src/runtime.ts'; import {draft,result} from './src/panel/state.ts'
    export function section(load) { return RecoverableSection({name:'History',load}) }
    export const draw=renderToString
    export function retry(tree) { tree.props.retry() }
    export function failed() {
      const boundary=new SectionBoundary({name:'History',retry(){},children:null})
      boundary.state=SectionBoundary.getDerivedStateFromError();boundary.componentDidCatch()
      return renderToStaticMarkup(boundary.render())
    }
    export function connection(state) {setCanvasConnection(state);return renderToStaticMarkup(React.createElement(CanvasConnectionNotice))}
    export const logs=()=>panelDiagnostics.snapshot()
    export function retain(){set(draft,'Keep 日本語 🧪');set(result,'Reviewed result')}
    export const values=()=>[read(draft),read(result)]
  `,resolveDir:process.cwd()},nodePaths:['web/node_modules'],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:'web/tsconfig.json',logLevel:'silent',plugins:[{name:'section-hooks',setup(b){
    b.onLoad({filter:/web[\\/]src[\\/]section-recovery\.tsx$/},async ({path})=>({loader:'tsx',contents:(await readFile(path,'utf8')).replace('useMemo, useState, ', '')+`
      let attempt=0, memo;
      function useState(){return [attempt,fn=>{attempt=fn(attempt)}]}
      function useMemo(fn,deps){if(!memo||memo.deps.some((v,i)=>v!==deps[i]))memo={value:fn(),deps};return memo.value}
    `}))
  }}]})
  const module={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
  const api=module.exports;api.retain();let calls=0
  const load=async()=>{if(++calls===1)throw Error('PRIVATE missing chunk');return {default:()=> 'History loaded'}}
  let tree=api.section(load)
  assert.match(api.draw(tree).replaceAll('<!-- -->',''),/Loading History/)
  await new Promise(resolve=>setImmediate(resolve))
  const error=api.failed();assert.match(error,/role="alert"/);assert.match(error,/Retry section/);assert.match(error,/copy any unsaved text/)
  api.retry(tree);tree=api.section(load);api.draw(tree);await new Promise(resolve=>setImmediate(resolve))
  assert.match(api.draw(api.section(load)),/History loaded/);assert.equal(calls,2)
  assert.deepEqual(api.values(),['Keep 日本語 🧪','Reviewed result'])
  assert.ok(api.logs().entries.some(entry=>entry.operation==='panel.section'&&entry.outcome==='failed'))
  assert.doesNotMatch(JSON.stringify(api.logs()),/PRIVATE|missing chunk/)
  assert.equal(api.connection('connected'),'')
  assert.match(api.connection('connecting'),/disabled=""/)
  assert.match(api.connection('reconnecting'),/Retry connection/)
  assert.match(api.connection('unavailable'),/reopen Enhance Prompt/)
  assert.doesNotMatch(api.connection('unavailable'),/Retry connection/)
})
