import { useEffect, useState } from 'react'
import { intervalToDuration, parseISO } from 'date-fns'

type Props = { deadlineIso: string }

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const end = new Date(Date.now() + ms)
  const start = new Date()
  const d = intervalToDuration({ start, end })
  const parts: string[] = []
  if (d.days) parts.push(`${d.days}d`)
  if (d.hours) parts.push(`${d.hours}h`)
  if (d.minutes) parts.push(`${d.minutes}m`)
  parts.push(`${d.seconds ?? 0}s`)
  return parts.join(' ')
}

export function Countdown({ deadlineIso }: Props) {
  const [leftMs, setLeftMs] = useState(() =>
    Math.max(0, parseISO(deadlineIso).getTime() - Date.now()),
  )

  useEffect(() => {
    const t = window.setInterval(() => {
      setLeftMs(Math.max(0, parseISO(deadlineIso).getTime() - Date.now()))
    }, 1000)
    return () => window.clearInterval(t)
  }, [deadlineIso])

  if (leftMs <= 0) {
    return <p className="countdown done">Submissions are closed.</p>
  }

  return (
    <p className="countdown">
      <span className="countdown-label">Deadline in </span>
      <strong>{formatDuration(leftMs)}</strong>
    </p>
  )
}
