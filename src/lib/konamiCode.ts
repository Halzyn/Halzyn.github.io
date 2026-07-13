export const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
  'Enter',
] as const

export function normalizeKonamiKey(event: KeyboardEvent): string | null {
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Enter':
      return event.key
    case 'b':
    case 'B':
      return 'b'
    case 'a':
    case 'A':
      return 'a'
    default:
      return null
  }
}

export function isKonamiKey(event: KeyboardEvent): boolean {
  return normalizeKonamiKey(event) != null
}

export function advanceKonamiProgress(progress: number, event: KeyboardEvent): number {
  const key = normalizeKonamiKey(event)
  if (key == null) return 0
  if (key === KONAMI_SEQUENCE[progress]) return progress + 1
  return key === KONAMI_SEQUENCE[0] ? 1 : 0
}

export function isKonamiComplete(progress: number): boolean {
  return progress >= KONAMI_SEQUENCE.length
}
