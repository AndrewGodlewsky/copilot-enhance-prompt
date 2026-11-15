import { body, finishFrame, finishPose, makeCrew, sampleCrew, type Point, type Token, type Word } from '../../src/panel/word-crew.ts'

/** Measure the textarea's native wrapping, including its padding and scroll position. */
export function measureWords(input: HTMLTextAreaElement): Word[] | null {
  if (!input.clientWidth || !input.clientHeight || !input.value) return null
  const style = getComputedStyle(input)
  const mirror = document.createElement('div')
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  Object.assign(mirror.style, {
    position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
    width: `${input.clientWidth}px`, boxSizing: 'border-box', border: '0',
    padding: style.padding, font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', tabSize: style.tabSize,
    direction: style.direction, textAlign: style.textAlign
  })
  const node = document.createTextNode(input.value)
  mirror.append(node)
  document.body.append(mirror)
  try {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return null
    context.font = font
    const metrics = context.measureText('Mg')
    const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent
    const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent
    const origin = mirror.getBoundingClientRect()
    const words: Word[] = []
    const range = document.createRange()
    const baseline = (rect: DOMRect) => rect.top - origin.top + (rect.height - ascent - descent) / 2 + ascent - input.scrollTop
    // Native wrapping stays exact; binary search skips offscreen text without measuring each word.
    const findOffset = (low: number, high: number, reached: (rect: DOMRect) => boolean): number | null => {
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        range.setStart(node, middle)
        range.setEnd(node, middle + 1)
        const rect = range.getClientRects()[0]
        if (!rect) return null
        if (reached(rect)) high = middle
        else low = middle + 1
      }
      return low
    }
    const start = findOffset(0, input.value.length, rect => baseline(rect) >= ascent)
    if (start === null) return null
    const end = findOffset(start, input.value.length, rect => baseline(rect) > input.clientHeight)
    if (end === null) return null
    for (const match of input.value.slice(start, end).matchAll(/\S+/gu)) {
      let from = start + match.index
      const to = from + match[0].length
      while (from < to) {
        range.setStart(node, from)
        range.setEnd(node, to)
        let rects = [...range.getClientRects()]
        if (!rects.length) return null
        let until = to
        if (rects.length > 1) {
          const nextLine = findOffset(from, to, rect => rect.top > rects[0].top)
          // Same-line bidi fragments cannot be redrawn as one SVG text run safely.
          if (nextLine === null || nextLine === from || nextLine === to) return null
          until = nextLine
          range.setStart(node, from)
          range.setEnd(node, until)
          rects = [...range.getClientRects()]
        }
        if (rects.length !== 1) return null
        const rect = rects[0], y = baseline(rect)
        if (y >= ascent && y <= input.clientHeight) {
          words.push({ text: input.value.slice(from, until), x: rect.left - origin.left - input.scrollLeft, y, width: rect.width })
        }
        from = until
      }
    }
    return words.length ? words : null
  } finally {
    mirror.remove()
  }
}

const ns = 'http://www.w3.org/2000/svg'
const attributes = (el: SVGElement, values: Record<string, string | number>) => {
  for (const [key, value] of Object.entries(values)) el.setAttribute(key, String(value))
}
const create = <K extends keyof SVGElementTagNameMap>(tag: K, values: Record<string, string | number> = {}) => {
  const el = document.createElementNS(ns, tag)
  attributes(el, values)
  return el
}
const path = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
const drawWord = (el: SVGTextElement, token: Token) => {
  el.textContent = token.text
  attributes(el, { x: token.x, y: token.y, opacity: token.opacity })
}

/** Owns only SVG nodes and its frame. The caller owns input locking and real run state. */
export function mountWordCrew(svg: SVGSVGElement, words: Word[], width: number, height: number, settled: () => void) {
  const seed = globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
  const crew = makeCrew(words, width, seed)
  const tokens = create('g', { fill: 'currentColor' })
  const people = create('g', { fill: 'none', stroke: 'var(--word-crew-ink)', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  const carried = create('g', { fill: 'currentColor' })
  const bar = create('path', { fill: 'none', stroke: 'var(--primary)', 'stroke-width': 3 })
  svg.replaceChildren(tokens, people, carried, bar)
  attributes(svg, { viewBox: `0 0 ${width} ${height}` })
  const wordEls = words.map(() => { const el = create('text'); tokens.append(el); return el })
  const figures = crew.actors.map(() => {
    const group = create('g'), head = create('circle', { r: 3.5, fill: 'var(--background)' }), lines = create('path')
    group.append(head, lines); people.append(group)
    return { group, head, lines }
  })
  const carryEls = crew.actors.map(() => { const el = create('text'); carried.append(el); return el })
  let time = 0, last: number | null = null, frame = 0, paused = false, disposed = false
  let retireAt: number | null = null, readyAt: number | null = null
  let world = sampleCrew(crew, 0)
  const draw = () => {
    const ending = retireAt === null ? null : finishFrame(time - retireAt, height, readyAt === null ? null : readyAt - retireAt)
    if (!ending) world = sampleCrew(crew, time)
    const poses = ending ? world.poses.map(pose => finishPose(pose, ending, width)) : world.poses
    world.tokens.forEach((word, i) => drawWord(wordEls[i], word))
    world.carried.forEach((word, i) => drawWord(carryEls[i], { ...word, y: poses[i].word.y }))
    poses.forEach((p, i) => {
      const figure = figures[i], b = body(p)
      attributes(figure.head, { cx: b.head.x, cy: b.head.y })
      attributes(figure.lines, { d: [path([{ x: b.head.x, y: b.head.y + 3.5 }, b.shoulder, b.hip]), ...b.arms.map(path), ...b.legs.map(path)].join(' ') })
      figure.group.style.visibility = p.visible === false ? 'hidden' : 'visible'
    })
    const translation = `translate(0 ${ending?.offset ?? 0})`
    tokens.setAttribute('transform', translation)
    carried.setAttribute('transform', translation)
    bar.setAttribute('d', ending?.sweeping ? `M0,${ending.barY} H${width}` : '')
    return ending
  }
  const dispose = () => { disposed = true; cancelAnimationFrame(frame); svg.replaceChildren() }
  const step = (now: number) => {
    if (disposed) return
    frame = 0
    const delta = last === null ? 0 : Math.min(.05, Math.max(0, (now - last) / 1000))
    last = now
    if (!paused || retireAt !== null) time += delta
    try {
      const ending = draw()
      if (ending?.done) { disposed = true; settled(); return }
      // No frame work while deposited words wait for the model. finish() wakes the sweep.
      if (ending?.exit === 1 && readyAt === null) { last = null; return }
      frame = requestAnimationFrame(step)
    } catch {
      // Artwork must never prevent editing or hide the actual result.
      dispose(); settled()
    }
  }
  draw() // Render before the hook hides the textarea, including the first frame's words.
  frame = requestAnimationFrame(step)
  return {
    retire() { if (!disposed && retireAt === null) retireAt = time },
    finish() {
      if (disposed || readyAt !== null) return
      if (retireAt === null) retireAt = time
      readyAt = time
      if (!frame) frame = requestAnimationFrame(step)
    },
    pause(value: boolean) { paused = value },
    dispose
  }
}
