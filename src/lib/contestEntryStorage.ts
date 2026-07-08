export const STORAGE_CONTESTS = 'vgmgc-contests'

type ContestsStorage = Record<string, string>

function readContests(): ContestsStorage {
  try {
    const raw = localStorage.getItem(STORAGE_CONTESTS)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const map: ContestsStorage = {}
    for (const [slug, token] of Object.entries(parsed)) {
      if (typeof slug === 'string' && typeof token === 'string' && token.length > 0) {
        map[slug] = token
      }
    }
    return map
  } catch {
    return {}
  }
}

function writeContests(map: ContestsStorage): void {
  try {
    localStorage.setItem(STORAGE_CONTESTS, JSON.stringify(map))
  } catch {
  }
}

export function getStoredEditToken(contestSlug: string): string {
  return readContests()[contestSlug] ?? ''
}

export function setStoredContestEntry(contestSlug: string, editToken: string): void {
  const map = readContests()
  map[contestSlug] = editToken
  writeContests(map)
}

export function clearStoredContestEntry(contestSlug: string): void {
  const map = readContests()
  if (!(contestSlug in map)) return
  delete map[contestSlug]
  writeContests(map)
}
