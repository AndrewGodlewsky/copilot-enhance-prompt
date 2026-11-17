import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvasEvents } from '../src/canvas-events.ts'

const until = async (check: () => boolean) => {
  const end = Date.now() + 2000
  while (!check() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 2))
  assert.ok(check())
}
test('event recovery coalesces Retry and never replays a command', async () => {
  let calls = 0, live = 0, peak = 0
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = [], states: string[] = [], received: unknown[] = []
  const stream = createCanvasEvents({
    connect: async signal => {
      calls++; live++; peak = Math.max(peak, live)
      return new Response(new ReadableStream({start(controller) { controllers.push(controller); signal.addEventListener('abort', () => {live--; controller.error(signal.reason)}, {once:true}) }}))
    }, event: value => received.push(value), state: value => states.push(value), retryMs: 10, idleMs: 1000
  })
  try {
    await until(() => states.includes('connected'))
    controllers[0].enqueue(new TextEncoder().encode('data: {"kind":"plugin","name":"progress","payload":{"runId":"original"}}\n\n'))
    await until(() => received.length === 1)
    controllers[0].error(new Error('Dropped'))
    await until(() => states.at(-1) === 'reconnecting')
    stream.retry(); stream.retry(); stream.retry()
    await until(() => calls === 2 && states.at(-1) === 'connected')
    assert.equal(received.length, 1)
    assert.equal(peak, 1)
    assert.ok(states.includes('connecting'))
  } finally { stream.close() }
})

test('coalesced valid frames may exceed the per-frame limit without losing events', async () => {
  let emitted=0, state=''
  const frame='data: '+JSON.stringify({kind:'plugin',payload:'x'.repeat(1100)})+'\n\n'
  const stream=createCanvasEvents({connect:async signal=>new Response(new ReadableStream({start(controller){
    controller.enqueue(new TextEncoder().encode(frame.repeat(70)))
    signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true})
  }})),event(){emitted++},state:value=>{state=value}})
  try {await until(()=>emitted===70||state==='reconnecting');assert.equal(emitted,70);assert.equal(state,'connected')}
  finally {stream.close()}
})

test('automatic failures back off to 30 seconds and a received heartbeat resets the delay', async context => {
  context.mock.timers.enable({apis:['setTimeout']})
  let calls=0, controller!:ReadableStreamDefaultController<Uint8Array>
  const turn=()=>new Promise<void>(resolve=>setImmediate(resolve))
  const stream=createCanvasEvents({connect:async signal=>{
    if(++calls<=6)return new Response('',{status:503})
    return new Response(new ReadableStream({start(value){controller=value;value.enqueue(new TextEncoder().encode(': heartbeat\n\n'));signal.addEventListener('abort',()=>value.error(signal.reason),{once:true})}}))
  },event(){},state(){}})
  try {
    await turn()
    for(const delay of [2000,4000,8000,16000,30000,30000]){
      const before=calls;context.mock.timers.tick(delay-1);await turn();assert.equal(calls,before)
      context.mock.timers.tick(1);await turn();assert.equal(calls,before+1)
    }
    controller.close();await turn()
    context.mock.timers.tick(1999);await turn();assert.equal(calls,7)
    context.mock.timers.tick(1);await turn();assert.equal(calls,8)
  }finally{stream.close();await turn();context.mock.timers.reset()}
})

test('missing or forbidden canvas stops automatic retries; manual Retry and close cannot revive it', async () => {
  for (const status of [401, 403, 404, 410]) {
    let calls = 0, state = ''
    const stream = createCanvasEvents({connect: async () => {calls++; return new Response('', {status})}, state: value => {state=value}, event() {}, retryMs: 1})
    await until(() => state === 'unavailable')
    stream.retry(); await new Promise(resolve => setTimeout(resolve, 15))
    assert.equal(calls, 1)
    stream.close(); stream.retry()
    assert.equal(calls, 1)
  }
})

test('header stalls, quiet streams, malformed and oversized frames recover without emitting unsafe data', async () => {
  for (const mode of ['headers','quiet','malformed','oversized','oversized-complete']) {
    let calls=0, emitted=0, state=''
    const stream = createCanvasEvents({connect: async signal => {
      calls++
      if (mode==='headers') return new Promise<Response>((_,reject) => signal.addEventListener('abort',()=>reject(signal.reason), {once:true}))
      return new Response(new ReadableStream({start(controller) {
        signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true})
        if (mode==='malformed') controller.enqueue(new TextEncoder().encode('data: not-json\n\n'))
        if (mode==='oversized') controller.enqueue(new TextEncoder().encode('x'.repeat(70000)))
        if (mode==='oversized-complete') controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({payload:'x'.repeat(70000)})+'\n\n'))
      }}))
    }, state:value=>{state=value}, event(){emitted++}, idleMs:20, retryMs:1000})
    await until(()=>state==='reconnecting')
    assert.equal(emitted,0); assert.equal(calls,1)
    stream.close(); await new Promise(resolve=>setTimeout(resolve,25)); assert.equal(calls,1)
  }
})
