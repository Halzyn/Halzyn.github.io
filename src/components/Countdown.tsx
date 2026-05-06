import { useEffect, useState } from 'react'

type Props = { deadlineIso: string }

function remainingMs(deadlineIso: string): number {
  const timestamp = Date.parse(deadlineIso)
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, timestamp - Date.now())
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s'
  let seconds = Math.floor(ms / 1000)
  const parts: string[] = []
  for (const [factor, unit] of [[86400, 'd'], [3600, 'h'], [60, 'm']] as const) {
    const value = Math.floor(seconds / factor)
    if (value) parts.push(`${value}${unit}`)
    seconds %= factor
  }
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function Countdown({ deadlineIso }: Props) {
  const [leftMs, setLeftMs] = useState(() => remainingMs(deadlineIso))

  useEffect(() => {
    const tick = () => setLeftMs(remainingMs(deadlineIso))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [deadlineIso])

  return (
    <p className={leftMs <= 0 ? 'countdown done' : 'countdown'}>
      {leftMs <= 0 ? (
        'Submissions are closed.'
      ) : (
        <>
          <span className="countdown-label">Countdown: </span>
          <strong>{formatRemaining(leftMs)}</strong>
        </>
      )}
    </p>
  )
}
