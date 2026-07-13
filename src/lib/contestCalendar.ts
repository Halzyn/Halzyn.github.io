export type ContestCalendarEventKind = 'deadline' | 'go-live'

export type ContestCalendarInput = {
  contestId: string
  contestTitle: string
  contestSlug?: string | null
  deadlineIso?: string | null
  scheduledPublishAtIso?: string | null
}

type CalendarEventDetails = {
  summary: string
  description: string
  startIso: string
  url?: string
}

function contestPageUrl(slug?: string | null): string | undefined {
  if (typeof window === 'undefined') return undefined
  const origin = window.location.origin
  return slug ? `${origin}/contests/${slug}` : origin
}

function googleUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function outlookIso(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function contestCalendarEvent(
  input: ContestCalendarInput,
  kind: ContestCalendarEventKind,
): CalendarEventDetails | null {
  const url = contestPageUrl(input.contestSlug)

  if (kind === 'go-live' && input.scheduledPublishAtIso) {
    return {
      summary: `${input.contestTitle} goes live`,
      description: 'A new video game music guessing contest opens for entries.',
      startIso: input.scheduledPublishAtIso,
      url,
    }
  }

  if (kind === 'deadline' && input.deadlineIso) {
    return {
      summary: `${input.contestTitle} deadline`,
      description: 'Last chance to submit entries for this contest.',
      startIso: input.deadlineIso,
      url,
    }
  }

  return null
}

export function googleCalendarUrl(event: CalendarEventDetails): string {
  const start = googleUtc(event.startIso)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${start}/${start}`,
    details: event.description,
  })
  if (event.url) params.set('location', event.url)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(event: CalendarEventDetails): string {
  const start = outlookIso(event.startIso)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.summary,
    startdt: start,
    enddt: start,
    body: event.description,
  })
  if (event.url) params.set('location', event.url)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
