import type { MouseEvent } from 'react'
import {
  contestCalendarEvent,
  googleCalendarUrl,
  outlookCalendarUrl,
  type ContestCalendarEventKind,
  type ContestCalendarInput,
} from '../lib/contestCalendar'

type Props = ContestCalendarInput & {
  events: ContestCalendarEventKind[]
}

function openCalendarUrl(event: MouseEvent<HTMLButtonElement>, url: string) {
  event.preventDefault()
  event.stopPropagation()
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function ContestCalendarLink({
  events,
  contestId,
  contestTitle,
  contestSlug,
  deadlineIso,
  scheduledPublishAtIso,
}: Props) {
  const eventKind = events.length === 1 ? events[0] : null
  if (!eventKind) return null

  const calendarEvent = contestCalendarEvent(
    { contestId, contestTitle, contestSlug, deadlineIso, scheduledPublishAtIso },
    eventKind,
  )
  if (!calendarEvent) return null

  const googleUrl = googleCalendarUrl(calendarEvent)
  const outlookUrl = outlookCalendarUrl(calendarEvent)

  return (
    <span className="contest-calendar-links">
      <button
        type="button"
        className="linkish small contest-calendar-link"
        onClick={(event) => openCalendarUrl(event, googleUrl)}
      >
        Google Calendar
      </button>
      {' ◦ '}
      <button
        type="button"
        className="linkish small contest-calendar-link"
        onClick={(event) => openCalendarUrl(event, outlookUrl)}
      >
        Outlook
      </button>
    </span>
  )
}
