import {
  buildContestIcal,
  downloadContestIcal,
  slugifyIcalFilename,
  type ContestCalendarEventKind,
  type ContestCalendarInput,
} from '../lib/contestIcal'
import type { MouseEvent } from 'react'

type Props = ContestCalendarInput & {
  events: ContestCalendarEventKind[]
  label?: string
}

export function ContestCalendarLink({
  events,
  label = 'Add to calendar',
  contestId,
  contestTitle,
  contestSlug,
  deadlineIso,
  scheduledPublishAtIso,
}: Props) {
  const hasEvents =
    (events.includes('deadline') && deadlineIso) ||
    (events.includes('go-live') && scheduledPublishAtIso)

  if (!hasEvents) return null

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    const ics = buildContestIcal(
      { contestId, contestTitle, contestSlug, deadlineIso, scheduledPublishAtIso },
      events,
    )
    const slugPart = contestSlug ? slugifyIcalFilename(contestSlug) : contestId.slice(0, 8)
    const eventPart = events.length === 1 ? events[0] : 'dates'
    downloadContestIcal(`vgmgc-${slugPart}-${eventPart}.ics`, ics)
  }

  return (
    <button type="button" className="linkish small contest-calendar-link" onClick={handleClick}>
      {label}
    </button>
  )
}
