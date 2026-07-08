import type { Track } from './types'
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

export function contestDifficultyWeight(tracks: Track[]): number {
  if (tracks.length === 0) return 1.0
  const sum = tracks.reduce((acc, track) => acc + difficultyPpWeight(track.difficulty), 0)
  return sum / tracks.length
}

export function contestRawPp(tracks: Track[], score: number): number {
  const trackCount = Math.max(tracks.length, 1)
  if (score <= 0) return 0

  const diffWeight = Math.max(contestDifficultyWeight(tracks), 0.5)
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
