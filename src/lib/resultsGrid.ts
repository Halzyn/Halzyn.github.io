import type { GradingMark } from './types'
import type { GameTooltip } from './gameTooltip'

function labeledLines(singular: string, plural: string, items: string[]): string | undefined {
  if (items.length === 0) return undefined
  if (items.length === 1) return `${singular}\n${items[0]}`
  return `${plural}\n${items.map((item) => `• ${item}`).join('\n')}`
}

export function buildGameColumnTip(names: string[], tooltip?: GameTooltip): string {
  if (tooltip) {
    const blocks = [
      labeledLines('Alternate title:', 'Alternate titles:', tooltip.alternateTitles),
      labeledLines(
        'Other game (same music):',
        'Other games (same music):',
        tooltip.sharedMusicTitles,
      ),
    ].filter((block): block is string => block !== undefined)
    if (blocks.length > 0) return blocks.join('\n\n')
  }
  return names.length > 1 ? names.slice(1).join('\n') : ''
}

const DIFFICULTY_CLASSES: Record<string, string> = {
  easy: 'results-diff-easy',
  medium: 'results-diff-medium',
  hard: 'results-diff-hard',
  insane: 'results-diff-insane',
  joke: 'results-diff-joke',
}

export function difficultyClass(difficulty: string | null): string {
  const key = difficulty?.trim().toLowerCase() ?? ''
  return DIFFICULTY_CLASSES[key] ?? 'results-diff-unknown'
}

function pairKey(submissionId: string, trackId: string): string {
  return `${submissionId}:${trackId}`
}

export function markMapFromMarks(marks: GradingMark[]): Map<string, 'game' | 'franchise'> {
  const map = new Map<string, 'game' | 'franchise'>()
  for (const mark of marks) {
    map.set(pairKey(mark.submission_id, mark.track_id), mark.mark)
  }
  return map
}

export function gradeCell(
  markMap: Map<string, 'game' | 'franchise'>,
  soloByTrack: Map<string, string>,
  submissionId: string,
  trackId: string,
): { text: string; cellClass: string } | null {
  const mark = markMap.get(pairKey(submissionId, trackId))
  if (mark === 'game') {
    const cellClass =
      soloByTrack.get(trackId) === submissionId
        ? 'results-grade-cell-solo'
        : 'results-grade-cell-game'
    return { text: 'X', cellClass }
  }
  if (mark === 'franchise') {
    return { text: '~', cellClass: 'results-grade-cell-fr' }
  }
  return null
}
