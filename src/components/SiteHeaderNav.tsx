import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthBar } from './AuthBar'
import { ThemeToggle } from './ThemeToggle'

const MAIN_NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/contests', label: 'Contests' },
  { to: '/rules', label: 'Rules' },
  { to: '/games', label: 'Games' },
  { to: '/players', label: 'Players' },
]

function isNavLinkActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function navLinkClass(isActive: boolean): string {
  return isActive ? 'site-nav-link is-active' : 'site-nav-link'
}

function navLinksFor(locationPathname: string, onNavigate?: () => void) {
  return MAIN_NAV_LINKS.map(({ to, label, end }) => {
    const active = isNavLinkActive(locationPathname, to, end)
    return (
      <Link
        key={to}
        to={to}
        className={navLinkClass(active)}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        {label}
      </Link>
    )
  })
}

export function SiteHeaderNav() {
  const location = useLocation()
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <div className="top-end">
        <button
          type="button"
          className="site-nav-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          <span className="site-nav-menu-toggle-bars" aria-hidden />
        </button>

        <nav className="nav site-nav site-nav--desktop" aria-label="Main">
          {navLinksFor(location.pathname)}
        </nav>

        <div className="top-end-toolbar">
          <div className="top-end-auth top-end-auth--desktop">
            <AuthBar />
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div id={menuId} className={`site-nav-panel${menuOpen ? ' is-open' : ''}`} hidden={!menuOpen}>
        <nav className="nav site-nav site-nav--mobile" aria-label="Main">
          {navLinksFor(location.pathname, closeMenu)}
        </nav>
        <div className="site-nav-mobile-auth">
          <AuthBar />
        </div>
      </div>
    </>
  )
}
