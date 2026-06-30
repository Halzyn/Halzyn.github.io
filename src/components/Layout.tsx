import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { HeaderBrand } from './HeaderBrand'
import { AuthBar } from './AuthBar'
import { DisplayNameStyled } from './DisplayNameStyled'
import { ContestHostName } from './ContestHostName'
import { getSupabase } from '../lib/supabase'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../lib/displayNameStyle'
import type { PublicProfile } from '../lib/types'

const SITE_HOST_PLAYER_NUMBER = 1

export function Layout() {
  const supabase = getSupabase()
  const [siteHostDisplayName, setSiteHostDisplayName] = useState('Halzyn (hazel)')
  const [siteHostUsername, setSiteHostUsername] = useState<string | null>(null)
  const [siteHostNameStyle, setSiteHostNameStyle] = useState<DisplayNameStyleInfo | null>(null)

  useEffect(() => {
    async function loadSiteHost() {
      const { data, error } = await supabase.rpc('list_players_public')
      if (error) return
      const host = (data as PublicProfile[]).find((p) => p.player_number === SITE_HOST_PLAYER_NUMBER)
      if (!host) return
      setSiteHostDisplayName(host.display_name)
      setSiteHostUsername(host.username)
      const { data: styleBlob, error: styleErr } = await supabase.rpc('profile_display_name_styles_for_users', {
        p_user_ids: [host.id],
      })
      if (!styleErr) {
        setSiteHostNameStyle(displayNameStyleMapFromRpc(styleBlob).get(host.id) ?? null)
      }
    }
    void loadSiteHost()
  }, [supabase])

  return (
    <div className="shell site-shell">
      <div className="site-shell-panel">
        <header className="top site-topbar">
          <HeaderBrand to="/" />
          <div className="top-end">
            <nav className="nav site-nav">
              <Link to="/">Home</Link>
              <Link to="/contests">Contests</Link>
              <Link to="/rules">Rules</Link>
              <Link to="/games">Games</Link>
              <Link to="/players">Players</Link>
            </nav>
            <AuthBar />
            <ThemeToggle />
          </div>
        </header>
        <main className="main main-shell">
          <Outlet />
        </main>
        <footer className="foot">
          <div className="foot-row">
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
