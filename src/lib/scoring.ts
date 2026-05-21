import type { GradingMark, Submission, Track } from './types'
import { pushToMappedList } from './utils'

export function soloGameWinnerByTrack(marks: GradingMark[]): Map<string, string> {
  const gameSubs = new Map<string, string[]>()
  for (const mark of marks) {
    if (mark.mark !== 'game') continue
    pushToMappedList(gameSubs, mark.track_id, mark.submission_id)
  }
  const solo = new Map<string, string>()
  for (const [trackId, subs] of gameSubs) {
    if (subs.length === 1) solo.set(trackId, subs[0]!)
  }
  return solo
}

export function scoreForSubmission(
  submissionId: string,
  trackOrder: string[],
  marks: GradingMark[],
): number {
  const solo = soloGameWinnerByTrack(marks)
  const byTrack = new Map<string, 'game' | 'franchise'>()
  for (const mark of marks) {
    if (mark.submission_id !== submissionId) continue
    byTrack.set(mark.track_id, mark.mark)
  }
  let total = 0
  for (const trackId of trackOrder) {
    const mark = byTrack.get(trackId)
    if (mark === 'game') {
      total += 1
      if (solo.get(trackId) === submissionId) total += 0.5
    } else if (mark === 'franchise') {
      total += 0.5
    }
  }
  return total
}

function normDifficulty(difficulty: string | null | undefined): string {
  return difficulty?.trim().toLowerCase() ?? ''
}

function countMarksOfKind(
  submissionId: string,
  marks: GradingMark[],
  kind: 'game' | 'franchise',
): number {
  let count = 0
  for (const mark of marks) {
    if (mark.submission_id === submissionId && mark.mark === kind) count++
  }
  return count
}

export function countCorrectGameMarks(submissionId: string, marks: GradingMark[]): number {
  return countMarksOfKind(submissionId, marks, 'game')
}

export function countCorrectFranchiseMarks(submissionId: string, marks: GradingMark[]): number {
  return countMarksOfKind(submissionId, marks, 'franchise')
}

export function countSoloMarks(submissionId: string, soloByTrack: Map<string, string>): number {
  let count = 0
  for (const [, sid] of soloByTrack) {
    if (sid === submissionId) count++
  }
  return count
}

export function countCorrectGamesOnDifficulty(
  submissionId: string,
  marks: GradingMark[],
  tracks: Track[],
  difficulty: 'insane' | 'hard' | 'medium',
): number {
  const diffByTrack = new Map(tracks.map((t) => [t.id, normDifficulty(t.difficulty)]))
  let count = 0
  for (const mark of marks) {
    if (mark.submission_id !== submissionId || mark.mark !== 'game') continue
    if (diffByTrack.get(mark.track_id) === difficulty) count++
  }
  return count
}

export type ContestRankRow = {
  id: string
  user_id?: string | null
  name: string
  score: number
  solo: number
  correctGames: number
  correctFranchise: number
  correctInsane: number
  correctHard: number
  correctMedium: number
}

function compareDesc(a: number, b: number): number {
  if (a === b) return 0
  return a > b ? -1 : 1
}

export function compareContestRank(a: ContestRankRow, b: ContestRankRow): number {
  return (
    compareDesc(a.score, b.score) ||
    compareDesc(a.correctGames, b.correctGames) ||
    compareDesc(a.solo, b.solo) ||
    compareDesc(a.correctInsane, b.correctInsane) ||
    compareDesc(a.correctHard, b.correctHard) ||
    compareDesc(a.correctMedium, b.correctMedium) ||
    a.name.localeCompare(b.name)
  )
}

export function areContestRanksTied(a: ContestRankRow, b: ContestRankRow): boolean {
  return (
    a.score === b.score &&
    a.correctGames === b.correctGames &&
    a.solo === b.solo &&
    a.correctInsane === b.correctInsane &&
    a.correctHard === b.correctHard &&
    a.correctMedium === b.correctMedium
  )
}

export function contestPlaceForIndex(rows: ContestRankRow[], index: number): number {
  for (let i = index; i >= 0; i--) {
    if (i === 0 || !areContestRanksTied(rows[i - 1]!, rows[index]!)) {
      return i + 1
    }
  }
  return 1
}

export function submissionDisplayNameForRank(
  submission: Submission,
  displayNameByUserId?: Map<string, string>,
): string {
  const userDisplayName =
    submission.user_id && displayNameByUserId?.get(submission.user_id)?.trim()
  return userDisplayName || submission.contestant_name
}

export function buildContestRankRows(
  submissions: Submission[],
  trackOrder: string[],
  marks: GradingMark[],
  tracks: Track[],
  displayNameByUserId?: Map<string, string>,
): ContestRankRow[] {
  const solo = soloGameWinnerByTrack(marks)
  const rows: ContestRankRow[] = submissions.map((submission) => ({
    id: submission.id,
    user_id: submission.user_id ?? null,
    name: submissionDisplayNameForRank(submission, displayNameByUserId),
    score: scoreForSubmission(submission.id, trackOrder, marks),
    solo: countSoloMarks(submission.id, solo),
    correctGames: countCorrectGameMarks(submission.id, marks),
    correctFranchise: countCorrectFranchiseMarks(submission.id, marks),
    correctInsane: countCorrectGamesOnDifficulty(submission.id, marks, tracks, 'insane'),
    correctHard: countCorrectGamesOnDifficulty(submission.id, marks, tracks, 'hard'),
    correctMedium: countCorrectGamesOnDifficulty(submission.id, marks, tracks, 'medium'),
  }))
  rows.sort(compareContestRank)
  return rows
}

export function sortSubmissionsByContestRank(
  submissions: Submission[],
  trackOrder: string[],
  marks: GradingMark[],
  tracks: Track[],
  displayNameByUserId?: Map<string, string>,
): Submission[] {
  const rows = buildContestRankRows(submissions, trackOrder, marks, tracks, displayNameByUserId)
  const byId = new Map(submissions.map((submission) => [submission.id, submission]))
  return rows.map((row) => byId.get(row.id)!)
}
