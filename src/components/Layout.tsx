import { Outlet } from 'react-router-dom'
import { HeaderBrand } from './HeaderBrand'
import { SiteHeaderNav } from './SiteHeaderNav'
import { SiteFooterNav } from './SiteFooterNav'
import { DisplayNameStyled } from './DisplayNameStyled'
import { ContestHostName } from './ContestHostName'
import { useSiteHost } from '../hooks/usePlayersQueries'

export function Layout() {
  const { data: siteHost } = useSiteHost()
  const siteHostDisplayName = siteHost?.displayName ?? 'Halzyn (hazel)'
  const siteHostUsername = siteHost?.username ?? null
  const siteHostNameStyle = siteHost?.nameStyle ?? null

  return (
    <div className="shell site-shell">
      <div className="site-shell-panel">
        <header id="top" className="top site-topbar">
          <div className="site-topbar-main">
            <HeaderBrand to="/" />
            <SiteHeaderNav />
          </div>
        </header>
        <main className="main main-shell">
          <Outlet />
        </main>
        <footer className="foot">
          <SiteFooterNav />
          <div className="foot-row foot-credit">
            <span>
              Contests hosted by{' '}
              {siteHostUsername ? (
                <ContestHostName
                  displayName={siteHostDisplayName}
                  profileUsername={siteHostUsername}
                  styleInfo={siteHostNameStyle}
                />
              ) : (
                <DisplayNameStyled text={siteHostDisplayName} info={siteHostNameStyle} />
              )}{' '}
              since 2016...
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
