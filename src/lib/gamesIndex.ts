export type GamesIndex = '#' | '0-9' | string

export function gamesIndex(title: string): GamesIndex {
  const cleanedTitle = title.trim()
  if (!cleanedTitle) return '#'
  const firstChar = cleanedTitle[0]!
  if (firstChar >= '0' && firstChar <= '9') return '0-9'
  const uppercaseFirstChar = firstChar.toUpperCase()
  if (uppercaseFirstChar >= 'A' && uppercaseFirstChar <= 'Z') return uppercaseFirstChar
  return '#'
}

export const GAMES_INDEX_ORDER: GamesIndex[] = [
  '#',
  '0-9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
]

export function compareGameTitles(a: string, b: string): number {
  return a.trim().toLocaleLowerCase().localeCompare(b.trim().toLocaleLowerCase(), undefined, {
    sensitivity: 'base',
  })
}

export function gamesSectionDomId(index: GamesIndex): string {
  if (index === '#') return 'games-section-sym'
  if (index === '0-9') return 'games-section-0-9'
  return `games-section-${index}`
}
