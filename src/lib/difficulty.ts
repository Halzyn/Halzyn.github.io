export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane' | 'joke' | 'other'

export function normalizeDifficultyKey(diff: string | null | undefined): string {
  return diff?.trim().toLowerCase() ?? ''
}

export function difficulty(diff: string | null | undefined): Difficulty {
  const cleanedDiff = normalizeDifficultyKey(diff)
  switch (cleanedDiff) {
    case 'easy':
    case 'medium':
    case 'hard':
    case 'insane':
    case 'joke':
      return cleanedDiff
    default:
      return 'other'
  }
}
