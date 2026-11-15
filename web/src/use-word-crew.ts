import { useLayoutEffect, useRef, useState } from 'react'
import type { Run } from '../../src/panel/state.ts'
import { measureWords, mountWordCrew } from './word-crew'

/** Canvas-local artwork. It cannot write a draft, invoke a model or send a prompt. */
export function useWordCrew(current: Run | null, text: string, workspace: string | null, percent = 0) {
  const input = useRef<HTMLTextAreaElement>(null)
  const scene = useRef<SVGSVGElement>(null)
  const controller = useRef<ReturnType<typeof mountWordCrew> | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const eligible = current && current.prompt === text.trim() && (!current.workspace || current.workspace.key === workspace)
  const runId = eligible ? current.runId : null
  const status = eligible ? current.status : null
  const reachedExit = percent >= 95

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    change()
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useLayoutEffect(() => {
    const textarea = input.current, svg = scene.current
    if (!textarea || !svg || !runId || status !== 'running' || reduced) return
    let disposed = false
    const stop = () => {
      controller.current?.dispose()
      controller.current = null
      if (!disposed) setActive(null)
    }
    let resize: ResizeObserver | undefined
    const hide = () => { if (document.hidden) stop() }
    try {
      const words = measureWords(textarea)
      if (!words || document.hidden) return
      const width = textarea.clientWidth, height = textarea.clientHeight
      const style = getComputedStyle(textarea)
      Object.assign(svg.style, {
        width: `${width}px`, height: `${height}px`, left: `${textarea.clientLeft}px`, top: `${textarea.clientTop}px`,
        font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, letterSpacing: style.letterSpacing
      })
      controller.current = mountWordCrew(svg, words, width, height, stop)
      setActive(runId)
      setPaused(false)
      setRetiring(false)
      resize = new ResizeObserver(() => {
        if (textarea.clientWidth !== width || textarea.clientHeight !== height) stop()
      })
      resize.observe(textarea)
      textarea.addEventListener('scroll', stop)
      document.addEventListener('visibilitychange', hide)
    } catch {
      stop()
    }
    return () => {
      stop()
      disposed = true
      resize?.disconnect()
      textarea.removeEventListener('scroll', stop)
      document.removeEventListener('visibilitychange', hide)
    }
    // Status changes finish/abort the existing scene below; they must not create another crew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, text, workspace, reduced])

  useLayoutEffect(() => {
    if (status === 'done' || (status === 'running' && reachedExit)) {
      if (status === 'done') controller.current?.finish()
      else controller.current?.retire()
      setRetiring(true)
      setPaused(false)
    }
    else if (status !== 'running') {
      controller.current?.dispose()
      controller.current = null
      setActive(null)
    }
  }, [runId, status, reachedExit, reduced, text, workspace])

  const visible = !!runId && active === runId && !reduced && (status === 'running' || status === 'done')
  return {
    input, scene, visible, paused, retiring,
    finishing: visible && status === 'done',
    togglePause() {
      const next = !paused
      controller.current?.pause(next)
      setPaused(next)
    }
  }
}
