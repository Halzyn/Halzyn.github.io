import type { Track } from './types'

export type EditDraftPayload = {
  submission_id?: string
  contestant_name?: string
  user_id?: string | null
  guesses?: { track_id: string; text: string }[]
}

export type AdminDraftPayload = {
  contest_id?: string
} & EditDraftPayload

export type SubmitContestPayload = {
  submission_id?: string
  edit_token?: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function submissionIdFromSearchParam(value: string | null): string {
  const raw = value ?? ''
  return UUID_PATTERN.test(raw) ? raw : ''
}

export function contestantNameFromDraft(row: EditDraftPayload): string {
  return row.contestant_name ?? ''
}

export function guessMapFromDraft(row: EditDraftPayload): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of row.guesses ?? []) {
    map.set(entry.track_id, entry.text ?? '')
  }
  return map
}

export function mergeDraftIntoGuessesState(
  draftByTrack: Map<string, string>,
  trackList: Track[],
  previous: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const t of trackList) {
    next[t.id] = draftByTrack.get(t.id) ?? previous[t.id] ?? ''
  }
  return next
}

export function countAnsweredGuesses(guesses: Record<string, string>): number {
  return Object.values(guesses).filter((text) => text.trim().length > 0).length
}

export function contestEntryLoadErrorMessage(message: string, published: boolean): string {
  if (message === 'Contest is not open.' && !published) {
    return 'This contest is not live yet. Your saved entry will load here once the contest is published.'
  }
  return message
}
