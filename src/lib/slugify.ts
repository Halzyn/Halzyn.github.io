export function playersSlug(username: string | null | undefined): string | null {
  if (typeof username !== 'string') return null
  const t = username.trim()
  return t.length > 0 ? t : null
}

function slugifyAsciiHyphenated(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugifyUrlSegment(raw: string): string {
  return slugifyAsciiHyphenated(raw)
}

export function slugifyGameTitle(raw: string): string {
  const s = slugifyAsciiHyphenated(raw)
  return s.length > 0 ? s.slice(0, 200) : 'game'
}
