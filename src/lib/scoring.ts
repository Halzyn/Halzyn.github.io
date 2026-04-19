import type { GradingMark } from './types'

/** Solo “only correct game guess” bonus: 0.5 when exactly one submission has mark `game` on a track. */
export function soloGameWinnerByTrack(marks: GradingMark[]): Map<string, string> {
  const gameSubs = new Map<string, string[]>()
  for (const m of marks) {
    if (m.mark !== 'game') continue
    const arr = gameSubs.get(m.track_id) ?? []
    arr.push(m.submission_id)
    gameSubs.set(m.track_id, arr)
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
  for (const m of marks) {
    if (m.submission_id === submissionId) {
      byTrack.set(m.track_id, m.mark)
    }
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

export function rankings(
  submissionIds: string[],
  trackOrder: string[],
  marks: GradingMark[],
): { submissionId: string; name: string; score: number }[] {
  // Caller attaches names
  return submissionIds.map((id) => ({
    submissionId: id,
    name: '',
    score: scoreForSubmission(id, trackOrder, marks),
  }))
}
