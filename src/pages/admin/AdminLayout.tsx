import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { HeaderBrand } from '../../components/HeaderBrand'
import { ThemeToggle } from '../../components/ThemeToggle'
import { getSupabase } from '../../lib/supabase'
import { signOutAndReloadHome } from '../../lib/auth'
import { contestIdFromModeratorAdminPath, normalizePathname } from '../../lib/adminPaths'
import { isNavLinkActive, siteNavLinkClass, type SiteNavLink } from '../../lib/siteNav'

function FloatingThemeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeToggle floating />
      {children}
    </>
  )
}

function SessionToolbar() {
  return (
    <>
      <button type="button" className="linkish" onClick={() => void signOutAndReloadHome()}>
        Sign out
      </button>
      <ThemeToggle />
    </>
  )
}

function AdminHeaderNav({ links, label }: { links: SiteNavLink[]; label: string }) {
  const location = useLocation()

  return (
    <div className="top-end">
      <nav className="nav site-nav site-nav--desktop" aria-label={label}>
        {links.map(({ to, label: linkLabel, end }) => {
          const active = isNavLinkActive(location.pathname, to, end)
          return (
            <Link
              key={to}
              to={to}
              className={siteNavLinkClass(active)}
              aria-current={active ? 'page' : undefined}
            >
              {linkLabel}
            </Link>
          )
        })}
      </nav>
      <div className="top-end-toolbar">
        <SessionToolbar />
      </div>
    </div>
  )
}

const ADMIN_NAV_LINKS: SiteNavLink[] = [
  { to: '/admin/contests', label: 'Contests' },
  { to: '/admin/games', label: 'Games' },
  { to: '/admin/users', label: 'Users' },
  { to: '/', label: 'Site', end: true },
]

function AdminNav() {
  return <AdminHeaderNav links={ADMIN_NAV_LINKS} label="Admin" />
}

function ModeratorNav({ contestId }: { contestId: string }) {
  const contestBase = `/admin/contests/${contestId}`
  const links: SiteNavLink[] = [
    { to: contestBase, label: 'Contest', end: true },
    { to: `${contestBase}/grade`, label: 'Grade' },
    { to: '/', label: 'Site', end: true },
  ]

  return <AdminHeaderNav links={links} label="Moderator" />
}

function SiteShell({
  brandHref,
  brandLabel,
  headerEnd,
  footerLabel,
}: {
  brandHref: string
  brandLabel: string
  headerEnd: ReactNode
  footerLabel: string
}) {
  return (
    <div className="shell site-shell">
      <div className="site-shell-panel">
        <header className="top site-topbar">
          <div className="site-topbar-main">
            <HeaderBrand to={brandHref} label={brandLabel}>
              {brandLabel !== 'VGMGC' ? <span className="site-brand-label">{brandLabel}</span> : null}
            </HeaderBrand>
            {headerEnd}
          </div>
        </header>
        <main className="main main-shell">
          <Outlet />
        </main>
        <footer className="foot">
          <div className="foot-row">
            <span>{footerLabel}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function isAdminLoginPath(pathname: string): boolean {
  return normalizePathname(pathname) === '/admin/login'
}

export function AdminLayout() {
  const supabase = getSupabase()
  const { session, ready, isAdmin } = useAuth()
  const location = useLocation()
  const onLoginScreen = isAdminLoginPath(location.pathname)

  const contestIdForModerator = useMemo(
    () => contestIdFromModeratorAdminPath(location.pathname),
    [location.pathname],
  )

  const [modAccess, setModAccess] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session?.user || isAdmin) {
      setModAccess(null)
      return
    }
    if (!contestIdForModerator) {
      setModAccess(false)
      return
    }

    async function checkContestModAccess() {
      const { data, error } = await supabase.rpc('is_contest_mod', {
        p_contest_id: contestIdForModerator,
      })
      if (error) {
        setModAccess(false)
        return
      }
      setModAccess(Boolean(data))
    }

    void checkContestModAccess()
  }, [session, isAdmin, contestIdForModerator, supabase])

  if (!ready) {
    return (
      <FloatingThemeLayout>
        <p className="muted">Loading...</p>
      </FloatingThemeLayout>
    )
  }

  if (onLoginScreen) {
    return (
      <SiteShell
        brandHref="/"
        brandLabel="VGMGC"
        headerEnd={
          <div className="top-end">
            <div className="top-end-toolbar">
              <ThemeToggle />
            </div>
          </div>
        }
        footerLabel="Admin sign-in ◦ VGMGC"
      />
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (isAdmin) {
    return (
      <SiteShell
        brandHref="/admin/contests"
        brandLabel="Admin"
        headerEnd={<AdminNav />}
        footerLabel="You're in the thick of it now... welcome to the admin zone"
      />
    )
  }

  if (!contestIdForModerator) {
    return <Navigate to="/404" replace />
  }

  if (modAccess === null) {
    return (
      <FloatingThemeLayout>
        <p className="muted">Checking moderator access...</p>
      </FloatingThemeLayout>
    )
  }

  if (!modAccess) {
    return <Navigate to="/404" replace />
  }

  return (
    <SiteShell
      brandHref={`/admin/contests/${contestIdForModerator}`}
      brandLabel="Moderator"
      headerEnd={<ModeratorNav contestId={contestIdForModerator} />}
      footerLabel="Contest moderation ◦ VGMGC"
    />
  )
}
