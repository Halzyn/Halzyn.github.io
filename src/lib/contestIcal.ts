export type ContestCalendarEventKind = 'deadline' | 'go-live'

export type ContestCalendarInput = {
  contestId: string
  contestTitle: string
  contestSlug?: string | null
  deadlineIso?: string | null
  scheduledPublishAtIso?: string | null
}

const PRODID = '-//Halzyn//VGMGC Contests//EN'
const CALENDAR_NAME = 'VGMGC Contests'

function icalUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function icalStamp(): string {
  return icalUtc(new Date().toISOString())
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function contestUrl(slug?: string | null): string | undefined {
  if (typeof window === 'undefined') return undefined
  const origin = window.location.origin
  return slug ? `${origin}/contests/${slug}` : origin
}

function buildEvent(params: {
  uid: string
  startIso: string
  endIso?: string
  summary: string
  description?: string
  url?: string
}): string {
  const start = icalUtc(params.startIso)
  const end = icalUtc(params.endIso ?? params.startIso)
  const lines = [
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${icalStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcalText(params.summary)}`,
  ]
  if (params.description) {
    lines.push(`DESCRIPTION:${escapeIcalText(params.description)}`)
  }
  if (params.url) {
    lines.push(`URL:${params.url}`)
  }
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export function buildContestIcal(
  input: ContestCalendarInput,
  events: ContestCalendarEventKind[],
): string {
  const url = contestUrl(input.contestSlug)
  const eventBlocks: string[] = []

  if (events.includes('go-live') && input.scheduledPublishAtIso) {
    eventBlocks.push(
      buildEvent({
        uid: `contest-${input.contestId}-go-live@halzyn`,
        startIso: input.scheduledPublishAtIso,
        summary: `${input.contestTitle} goes live`,
        description: 'A new video game music guessing contest opens for entries.',
        url,
      }),
    )
  }

  if (events.includes('deadline') && input.deadlineIso) {
    eventBlocks.push(
      buildEvent({
        uid: `contest-${input.contestId}-deadline@halzyn`,
        startIso: input.deadlineIso,
        summary: `${input.contestTitle} deadline`,
        description: 'Last chance to submit entries for this contest.',
        url,
      }),
    )
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(CALENDAR_NAME)}`,
    ...eventBlocks,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function slugifyIcalFilename(slug: string): string {
  return slug.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'contest'
}

export function downloadContestIcal(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
