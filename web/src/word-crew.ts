import { body, finishFrame, finishPose, makeCrew, sampleCrew, type Point, type Token, type Word } from '../../src/panel/word-crew.ts'

/** Measure the textarea's native wrapping, including its padding and scroll position. */
export function measureWords(input: HTMLTextAreaElement): Word[] | null {
  // Bound decorative work only; large requests remain fully supported by the editor and model.
  if (!input.clientWidth || input.value.length > 20_000) return null
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
    for (const match of input.value.matchAll(/\S+/gu)) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const rects = [...range.getClientRects()]
      // A token broken across lines or bidi runs needs multiple glyph positions. Keep the native
      // text visible for those layouts rather than approximate it and make the paragraph jump.
      if (rects.length !== 1) return null
      const rect = rects[0]
      const y = rect.top - origin.top + (rect.height - ascent - descent) / 2 + ascent - input.scrollTop
      if (y >= ascent && y <= input.clientHeight) {
        words.push({ text: match[0], x: rect.left - origin.left - input.scrollLeft, y, width: rect.width })
      }
    }
    return words.length && words.length <= 160 ? words : null
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
  const people = create('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
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
  let finishAt: number | null = null
  let world = sampleCrew(crew, 0)
  const draw = () => {
    const ending = finishAt === null ? null : finishFrame(time - finishAt, height)
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
    return ending?.done ?? false
  }
  const dispose = () => { disposed = true; cancelAnimationFrame(frame); svg.replaceChildren() }
  const step = (now: number) => {
    if (disposed) return
    const delta = last === null ? 0 : Math.min(.05, Math.max(0, (now - last) / 1000))
    last = now
    if (!paused || finishAt !== null) time += delta
    try {
      if (draw()) { disposed = true; settled(); return }
      frame = requestAnimationFrame(step)
    } catch {
      // Artwork must never prevent editing or hide the actual result.
      dispose(); settled()
    }
  }
  draw() // Render before the hook hides the textarea, including the first frame's words.
  frame = requestAnimationFrame(step)
  return {
    finish() { if (finishAt === null) finishAt = time },
    pause(value: boolean) { paused = value },
    dispose
  }
}
