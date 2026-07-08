import type { GradingMark, Track } from './types'
import { difficulty } from './difficulty'

const DIFFICULTY_PP_WEIGHT: Record<string, number> = {
  easy: 1.0,
  joke: 0.85,
  medium: 1.25,
  hard: 1.5,
  insane: 2.0,
  other: 1.0,
}

export function difficultyPpWeight(diff: string | null | undefined): number {
  return DIFFICULTY_PP_WEIGHT[difficulty(diff)] ?? 1.0
}

function soloGameWinnerByTrack(marks: GradingMark[]): Map<string, string> {
  const gameSubs = new Map<string, string[]>()
  for (const mark of marks) {
    if (mark.mark !== 'game') continue
    const subs = gameSubs.get(mark.track_id) ?? []
    subs.push(mark.submission_id)
    gameSubs.set(mark.track_id, subs)
  }
  const solo = new Map<string, string>()
  for (const [trackId, subs] of gameSubs) {
    if (subs.length === 1) solo.set(trackId, subs[0]!)
  }
  return solo
}

export function submissionDifficultyWeight(
  submissionId: string,
  trackOrder: string[],
  marks: GradingMark[],
  tracks: Track[],
): number {
  const diffByTrack = new Map(tracks.map((t) => [t.id, difficultyPpWeight(t.difficulty)]))
  const solo = soloGameWinnerByTrack(marks)
  const byTrack = new Map<string, 'game' | 'franchise'>()
  for (const mark of marks) {
    if (mark.submission_id !== submissionId) continue
    byTrack.set(mark.track_id, mark.mark)
  }

  let weightedSum = 0
  let points = 0
  for (const trackId of trackOrder) {
    const mark = byTrack.get(trackId)
    if (!mark) continue
    const diffWeight = diffByTrack.get(trackId) ?? 1.0
    if (mark === 'game') {
      const markPoints = solo.get(trackId) === submissionId ? 1.5 : 1.0
      weightedSum += diffWeight * markPoints
      points += markPoints
    } else if (mark === 'franchise') {
      weightedSum += diffWeight * 0.5
      points += 0.5
    }
  }

  return points > 0 ? weightedSum / points : 1.0
}

export function contestRawPp(
  tracks: Track[],
  score: number,
  submissionId?: string,
  trackOrder?: string[],
  marks?: GradingMark[],
): number {
  const trackCount = Math.max(tracks.length, 1)
  if (score <= 0) return 0

  const diffWeight = Math.max(
    submissionId && trackOrder && marks
      ? submissionDifficultyWeight(submissionId, trackOrder, marks, tracks)
      : tracks.reduce((acc, t) => acc + difficultyPpWeight(t.difficulty), 0) / trackCount,
    0.5,
  )
  const accuracy = Math.min(Math.max(score, 0) / (trackCount * 1.5), 1.0)
  const raw = 180 * diffWeight ** 1.5 * accuracy ** 1.6
  return Math.round(raw * 100) / 100
}

export function formatContestPp(points: number): string {
  return `${points.toFixed(2)}pp`
}

export type PpRankProfile = {
  id: string
  performance_points?: number | null
}

export function computePpRankByUserId(profiles: PpRankProfile[]): Map<string, number> {
  const byPp = [...profiles].sort((a, b) => (b.performance_points ?? 0) - (a.performance_points ?? 0))
  const map = new Map<string, number>()
  let rank = 0
  let prevPp: number | null = null
  for (let i = 0; i < byPp.length; i++) {
    const pp = byPp[i].performance_points ?? 0
    if (prevPp === null || pp < prevPp) {
      rank = i + 1
      prevPp = pp
    }
    map.set(byPp[i].id, rank)
  }
  return map
}

export function formatPlayerListPp(points: number | null | undefined): string {
  return `${Math.floor(points ?? 0)}pp`
}
