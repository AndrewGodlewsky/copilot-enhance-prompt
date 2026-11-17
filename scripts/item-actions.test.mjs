import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('repeated controls name the rule, profile and structure they act on, including duplicate and empty labels', async () => {
  const compiled = await build({ stdin: { contents: `
    import React from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import { ModelsSection, RulesSection } from './src/sections.tsx'
    import { TooltipProvider } from './src/components/ui/tooltip.tsx'
    import { set } from '../src/runtime.ts'
    import { models, rulesState } from '../src/panel/state.ts'
    export function render() {
      set(models, { profiles: ['Primary', 'Primary', '', '🧭'.repeat(100)].map((name,i)=>({ id:'p'+i, name, enabled:i!==1, provider:'copilot', preset:'copilot', model:'fixture', effectiveModel:'fixture' })), selectorProfileId:null })
      set(rulesState, { rules:[{id:'r1',text:'Run tests',enabled:true,scope:''},{id:'r2',text:'Run tests',enabled:false,scope:''},{id:'r3',text:'W'.repeat(100),enabled:true,scope:''}], structures:[{id:'brief',name:'My brief',sections:['Goal']},{id:'custom',name:'My brief',sections:['Result']}] })
      return renderToStaticMarkup(React.createElement(TooltipProvider, null, React.createElement(React.Fragment,null,React.createElement(ModelsSection),React.createElement(RulesSection))))
    }`, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) }, tsconfig:'web/tsconfig.json',bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',loader:{'.css':'empty'},
    // Render menu-item props without opening/automating a browser. Real menu/focus
    // behavior remains an owner check; this tests the production action names.
    plugins:[{name:'inspect-menu-items',setup(b){
      b.onResolve({filter:/^@\/components\/ui\/dropdown-menu$/},()=>({path:'menu',namespace:'fixture'}))
      b.onResolve({filter:/^@\/components\/ui\/tooltip$/},()=>({path:'tooltip',namespace:'fixture'}))
      b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='tooltip'
        ? `import React from 'react'; export const Tooltip=({children})=>children; export const TooltipTrigger=Tooltip; export const TooltipProvider=Tooltip; export const TooltipContent=({children,className})=>React.createElement('div',{'data-role':'tooltip',className},children);`
        : `import React from 'react'; export const DropdownMenu=({children})=>children; export const DropdownMenuContent=DropdownMenu; export const DropdownMenuTrigger=DropdownMenu; export const DropdownMenuSeparator=()=>null; export const DropdownMenuItem=({children,disabled,...props})=>React.createElement('button',{'aria-label':props['aria-label'],disabled},children);`,resolveDir:fileURLToPath(new URL('../web/',import.meta.url))}))
    }}]
  })
  const module={exports:{}}
  new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
  const html=module.exports.render()
  const names=[...html.matchAll(/aria-label="([^"]+)"/g)].map(match=>match[1])
  for(const expected of [
    'Disable model profile 1: Primary','Enable model profile 2: Primary','More actions for model profile 3: Untitled',
    'Edit model profile 1: Primary','Delete model profile 2: Primary','Move up model profile 2: Primary','Move down model profile 1: Primary',
    'Model for model profile 1: Primary','Test model profile 3: Untitled',
    'Disable rule 1: Run tests','Enable rule 2: Run tests','Delete rule 1: Run tests','Delete rule 2: Run tests',
    'Edit structure 1: My brief','Restore the default for structure 1: My brief','Delete structure 3: My brief'
  ]) assert.ok(names.includes(expected),expected)
  assert.ok(names.includes('Test model profile 4: ' + '🧭'.repeat(96) + '…'))
  for(const generic of ['Enable','Disable','More','Edit','Delete']) assert.ok(!names.includes(generic),generic)
  const tooltip=[...html.matchAll(/<div data-role="tooltip"([^>]*)>([^<]*)<\/div>/g)].find(match=>match[2].includes('W'.repeat(96)))
  assert.ok(tooltip, 'render the long-token tooltip content')
  assert.match(tooltip[1], /max-w-\[min\(24rem,calc\(100vw-24px\)\)\]/)
  assert.match(tooltip[1], /\[overflow-wrap:anywhere\]/)
})
