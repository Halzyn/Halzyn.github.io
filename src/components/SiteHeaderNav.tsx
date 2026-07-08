import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthBar } from './AuthBar'
import { ThemeToggle } from './ThemeToggle'
import { isNavLinkActive, MAIN_NAV_LINKS, siteNavLinkClass } from '../lib/siteNav'

function navLinksFor(locationPathname: string, onNavigate?: () => void) {
  return MAIN_NAV_LINKS.map(({ to, label, end }) => {
    const active = isNavLinkActive(locationPathname, to, end)
    return (
      <Link
        key={to}
        to={to}
        className={siteNavLinkClass(active)}
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
