/** An absolute deadline, independent of toast hover/visibility pauses. */
export const isExpired = (expiresAt: number, now = Date.now()) => !Number.isFinite(expiresAt) || expiresAt <= now

export function watchExpiry(expiresAt: number, expire: () => void, clock: {
  now: () => number
  schedule: (callback: () => void, ms: number) => () => void
  onResume: (callback: () => void) => () => void
}): () => void {
  let done = false
  let cancelTimer = () => {}
  const check = () => {
    cancelTimer()
    if (done) return
    if (isExpired(expiresAt, clock.now())) { done = true; expire() }
    else cancelTimer = clock.schedule(check, Math.min(2_147_483_647, expiresAt - clock.now()))
  }
  const stopResume = clock.onResume(check)
  check()
  return () => { done = true; cancelTimer(); stopResume() }
}
