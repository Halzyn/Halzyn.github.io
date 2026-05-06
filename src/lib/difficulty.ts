export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane' | 'joke' | 'other'

export function difficulty(diff: string | null | undefined): Difficulty {
  const cleanedDiff = diff?.trim().toLowerCase() ?? ''
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
