import { Fragment } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FOOTER_NAV_LINKS, isNavLinkActive, siteNavLinkClass } from '../lib/siteNav'

export function SiteFooterNav() {
  const location = useLocation()

  return (
    <nav className="foot-nav" aria-label="Footer">
      {FOOTER_NAV_LINKS.map((link, index) => {
        const active =
          !link.external && !link.hash && isNavLinkActive(location.pathname, link.to, link.end)
        const className = siteNavLinkClass(active)

        return (
          <Fragment key={link.to}>
            {index > 0 ? (
              <span className="foot-nav-sep" aria-hidden>
                {' '}
                ·{' '}
              </span>
            ) : null}
            {link.external ? (
              <a href={link.to} className="site-nav-link" rel="noopener noreferrer" target="_blank">
                {link.label}
              </a>
            ) : link.hash ? (
              <a href={link.to} className="site-nav-link">
                {link.label}
              </a>
            ) : (
              <Link to={link.to} className={className} aria-current={active ? 'page' : undefined}>
                {link.label}
              </Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
