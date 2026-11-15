import { memo, useEffect, useState } from 'react'
import { ContrastIcon } from 'lucide-react'
import { read } from '#panel'
import { BRAND } from '../../src/brand.ts'
import { currentTheme, DESK_STATUS_LABELS, deskState, deskTime, toggleTheme, type DeskState, type DeskTime } from '../../src/panel/appearance.ts'
import { IconAction } from './common'

/** Decorative, still artwork. Memoization keeps typing and progress ticks from repainting it. */
export const DeskIllustration = memo(function DeskIllustration({ time, state }: { time: DeskTime; state: DeskState }) {
  const night = time === 'night'
  const morning = time === 'morning'
  const sky = night ? '#293b60' : morning ? '#efc99a' : '#a9cfe1'
  const hills = night ? '#384969' : morning ? '#c09a7c' : '#81b6bd'
  return (
    <svg viewBox="0 0 360 165" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <rect x="196" y="4" width="146" height="98" rx="3" fill="var(--desk-back)" />
      <rect x="202" y="10" width="134" height="86" fill={sky} />
      {night ? <>
        <path d="M287 14A13 13 0 1 0 303 31A13 13 0 0 1 287 14Z" fill="#f1dfb2" />
        <g fill="#cbd5df"><rect x="224" y="19" width="2" height="2" /><rect x="258" y="33" width="2" height="2" /><rect x="315" y="50" width="2" height="2" /></g>
      </> : <>
        <circle cx={morning ? 235 : 291} cy={morning ? 51 : 25} r="13" fill="#fff0be" />
        <path d="M229 26H252M222 31H263M283 56H309" stroke="#f2f5ea" strokeWidth="4" fill="none" />
      </>}
      <path d="M202 81L229 67L249 77L274 63L303 76L336 63V96H202Z" fill={hills} />
      <path d="M202 93L241 83L281 91L313 78L336 85V96H202Z" fill="var(--desk-back)" />
      <path d="M269 10V96M202 55H336" stroke="var(--desk-muted)" strokeWidth="4" fill="none" />
      <rect x="192" y="100" width="154" height="6" fill="var(--desk-muted)" />
      {night && <path d="M82 73L41 138H147L103 73Z" fill="var(--desk-lamplight)" />}
      <path d="M0 138H360V151H0Z" fill="var(--desk-muted)" /><path d="M0 151H360V165H0Z" fill="var(--desk-back)" />
      <path d="M20 136H63M41 134V85L83 52" fill="none" stroke="var(--desk-ink)" strokeWidth="7" />
      <circle cx="42" cy="85" r="6" fill="var(--desk-brass)" />
      <path d="M72 50L89 43L114 71L78 83Z" fill="var(--desk-brass)" /><path d="M79 83L113 72" stroke="var(--desk-paper)" strokeWidth="4" fill="none" />
      <path d="M123 119H230L242 136H111Z" fill="var(--desk-ink)" /><rect x="120" y="108" width="112" height="13" rx="3" fill="var(--desk-muted)" />
      <rect x="135" y="47" width="82" height="66" fill="var(--desk-paper)" />
      {state !== 'idle' && <g fill="var(--desk-ink)">
        <rect x="147" y="58" width="31" height="5" /><rect x="147" y="72" width="37" height="2" /><rect x="147" y="79" width="52" height="2" /><rect x="147" y="86" width="29" height="2" />
      </g>}
      <path d="M127 126H219M133 132H224" stroke="var(--desk-paper)" strokeWidth="3" strokeDasharray="5 3" fill="none" />
      {state === 'ready' && <g transform="rotate(8 270 119)">
        <rect x="247" y="67" width="57" height="73" fill="var(--desk-paper)" />
        <g fill="var(--desk-ink)"><rect x="254" y="77" width="25" height="4" /><rect x="254" y="89" width="41" height="2" /><rect x="254" y="96" width="36" height="2" /><rect x="254" y="103" width="40" height="2" /><rect x="254" y="114" width="28" height="3" /></g>
        <path d="M284 126L288 130L297 120" fill="none" stroke="var(--desk-green)" strokeWidth="3" />
      </g>}
      {state === 'error' && <><rect x="199" y="51" width="14" height="18" fill="var(--desk-brass)" /><path d="M206 55V61M206 63V65" stroke="var(--desk-ink)" strokeWidth="2" fill="none" /></>}
      {state === 'running' && <rect x="134" y="101" width="84" height="5" fill="var(--desk-brass)" />}
      {state === 'cancelled' && <path d="M176 99H202" stroke="var(--desk-muted)" strokeWidth="3" fill="none" />}
      <path d="M325 117V82M325 102Q303 101 309 87Q325 88 325 102M325 94Q341 93 340 77Q326 78 325 94" fill="var(--desk-green)" stroke="var(--desk-green)" strokeWidth="3" />
      <path d="M311 116H340L337 138H315Z" fill="var(--desk-brass)" />
      <rect x="73" y="119" width="19" height="17" rx="2" fill="var(--desk-paper)" /><path d="M92 122H98V131H92" fill="none" stroke="var(--desk-paper)" strokeWidth="3" />
    </svg>
  )
})

export function QuietDesk() {
  const [time, setTime] = useState(() => deskTime(new Date()))
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setTime(deskTime(new Date())) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const state = read(deskState)
  const themeLabel = read(currentTheme) === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <div className="quiet-desk">
      <div className="quiet-desk-copy">
        <p className="quiet-desk-platform">{'GitHub Copilot'}</p>
        <h1>{BRAND}</h1>
        <p className="quiet-desk-tagline">{'A little more thought. A clearer prompt.'}</p>
        <p className="quiet-desk-status" data-state={state} role="status"><span aria-hidden="true" />{DESK_STATUS_LABELS[state]}</p>
      </div>
      <IconAction label={themeLabel} onClick={toggleTheme} variant="outline" className="quiet-desk-theme size-9"><ContrastIcon aria-hidden="true" className="size-4" /></IconAction>
      <div className="quiet-desk-scene"><DeskIllustration time={time} state={state} /></div>
    </div>
  )
}
