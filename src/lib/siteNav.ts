export type SiteNavLink = {
  to: string
  label: string
  end?: boolean
  external?: boolean
  hash?: boolean
}

export const MAIN_NAV_LINKS: SiteNavLink[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/contests', label: 'Contests' },
  { to: '/rules', label: 'Rules' },
  { to: '/games', label: 'Games' },
  { to: '/tracks', label: 'Tracks' },
  { to: '/players', label: 'Players', end: true },
]

export const FOOTER_NAV_LINKS: SiteNavLink[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/contests', label: 'Contests' },
  { to: '/rules', label: 'Rules' },
  { to: '/games', label: 'Games' },
  { to: '/tracks', label: 'Tracks' },
  { to: '/players', label: 'Players', end: true },
  { to: '#top', label: 'Jump to top', hash: true },
]

export function isNavLinkActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function isProfileNavActive(pathname: string, profileTo: string): boolean {
  if (pathname.startsWith('/profile/')) return true
  return pathname === profileTo
}

export function siteNavLinkClass(isActive: boolean): string {
  return isActive ? 'site-nav-link is-active' : 'site-nav-link'
}
