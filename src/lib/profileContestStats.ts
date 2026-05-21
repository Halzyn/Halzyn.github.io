import type { Contest, GradingMark, Submission, Track } from './types'
import {
  buildContestRankRows,
  contestPlaceForIndex,
  scoreForSubmission,
  soloGameWinnerByTrack,
  countCorrectGameMarks,
  countCorrectFranchiseMarks,
  countSoloMarks,
} from './scoring'
import { difficulty, type Difficulty } from './difficulty'
import { pushToMappedList } from './utils'

const STARTING_POINTS: Record<Difficulty, number> = {
  easy: 0,
  medium: 0,
  hard: 0,
  insane: 0,
  joke: 0,
  other: 0,
}

function submissionsByContest(submissions: Submission[]): Map<string, Submission[]> {
  const map = new Map<string, Submission[]>()
  for (const submission of submissions)
    pushToMappedList(map, submission.contest_id, submission)
  return map
}

function tracksByContest(tracks: Track[]): Map<string, Track[]> {
  const map = new Map<string, Track[]>()
  for (const track of tracks) pushToMappedList(map, track.contest_id, track)
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }
  return map
}

function marksByContest(
  marks: GradingMark[],
  submissionById: Map<string, Submission>,
): Map<string, GradingMark[]> {
  const map = new Map<string, GradingMark[]>()
  for (const mark of marks) {
    const submission = submissionById.get(mark.submission_id)
    if (!submission) continue
    pushToMappedList(map, submission.contest_id, mark)
  }
  return map
}

export type ProfileContestStatsResult = {
  totalGame: number
  totalFranchise: number
  totalSolo: number
  byDiff: Record<Difficulty, number>
  contests: { contest: Contest; rank: number; total: number; score: number }[]
}

export function computeProfileContestStats(
  mySubmissions: Submission[],
  contests: Contest[],
  tracks: Track[],
  submissionsInContests: Submission[],
  marks: GradingMark[],
): ProfileContestStatsResult {
  if (mySubmissions.length === 0) {
    return {
      totalGame: 0,
      totalFranchise: 0,
      totalSolo: 0,
      byDiff: { ...STARTING_POINTS },
      contests: [],
    }
  }

  const submissionById = new Map(submissionsInContests.map((s) => [s.id, s]))
  const mySubmissionByContestId = new Map(mySubmissions.map((s) => [s.contest_id, s]))

  const subsByContest = submissionsByContest(submissionsInContests)
  const tracksByContestMap = tracksByContest(tracks)
  const marksByContestMap = marksByContest(marks, submissionById)

  let totalGame = 0
  let totalFranchise = 0
  let totalSolo = 0
  const byDiff: Record<Difficulty, number> = { ...STARTING_POINTS }

  const contestStats: ProfileContestStatsResult['contests'] = []

  for (const contest of contests) {
    const contestId = contest.id

    const contestTracks = tracksByContestMap.get(contestId) ?? []
    const trackOrder = contestTracks.map((t) => t.id)
    const submissions = subsByContest.get(contestId) ?? []
    if (submissions.length === 0) continue

    const contestMarks = marksByContestMap.get(contestId) ?? []

    const rows = buildContestRankRows(submissions, trackOrder, contestMarks, contestTracks)
    const mySubmission = mySubmissionByContestId.get(contestId)
    const rankIndex = mySubmission ? rows.findIndex((row) => row.id === mySubmission.id) : -1
    const rank = rankIndex >= 0 ? contestPlaceForIndex(rows, rankIndex) : 0
    const score = mySubmission ? scoreForSubmission(mySubmission.id, trackOrder, contestMarks) : 0

    contestStats.push({
      contest,
      rank,
      total: rows.length,
      score,
    })

    if (!mySubmission) continue

    totalGame += countCorrectGameMarks(mySubmission.id, contestMarks)
    totalFranchise += countCorrectFranchiseMarks(mySubmission.id, contestMarks)
    totalSolo += countSoloMarks(mySubmission.id, soloGameWinnerByTrack(contestMarks))

    for (const mark of contestMarks) {
      if (mark.submission_id !== mySubmission.id || mark.mark !== 'game') continue
      const track = contestTracks.find((t) => t.id === mark.track_id)
      byDiff[difficulty(track?.difficulty)]++
    }
  }

  return { totalGame, totalFranchise, totalSolo, byDiff, contests: contestStats }
}
