import type { SiteBackgroundPattern } from '../lib/types'

export function parseSiteBackgroundPattern(value: unknown): SiteBackgroundPattern {
  return value === 'dk64' ? 'dk64' : 'none'
}

export function applySiteBackgroundPattern(pattern: SiteBackgroundPattern): void {
  document.documentElement.setAttribute('data-site-bg', pattern)
}
