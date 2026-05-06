export const SITE_TITLE = 'VGMGC'

export function pageTitle(...segments: string[]): string {
  const parts = segments.map((segment) => segment.trim()).filter(Boolean)
  return [...parts, SITE_TITLE].join(' / ')
}
