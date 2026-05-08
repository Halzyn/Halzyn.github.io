import type { SiteBackgroundPattern } from '../lib/types'

export function parseSiteBackgroundPattern(value: unknown): SiteBackgroundPattern {
  if (value === 'dk64') return 'dk64'
  if (value === 'furnacefun') return 'furnacefun'
  if (value === 'smwc') return 'smwc'
  if (value === 'candycavios') return 'candycavios'
  if (value === 'cutestripes') return 'cutestripes'
  if (value === 'miningmelancholy') return 'miningmelancholy'
  if (value === 'outer_wall') return 'outer_wall'
  return 'none'
}

export function applySiteBackgroundPattern(pattern: SiteBackgroundPattern): void {
  document.documentElement.setAttribute('data-site-bg', pattern)
}
