import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { getSupabase } from '../../lib/supabase'
import { signOutAndReloadHome } from '../../lib/auth'
import { contestIdFromModeratorAdminPath, normalizePathname } from '../../lib/adminPaths'

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

function AdminNav() {
  return (
    <nav className="nav site-nav">
      <Link to="/admin/contests">Contests</Link>
      <Link to="/admin/games">Games</Link>
      <Link to="/admin/users">Users</Link>
      <Link to="/">Site</Link>
      <SessionToolbar />
    </nav>
  )
}

function ModeratorNav({ contestId }: { contestId: string }) {
  const contestBase = `/admin/contests/${contestId}`
  return (
    <nav className="nav site-nav">
      <Link to={contestBase}>Contest</Link>
      <Link to={`${contestBase}/grade`}>Grade</Link>
      <Link to="/">Site</Link>
      <SessionToolbar />
    </nav>
  )
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
      <header className="top site-topbar">
        <Link to={brandHref} className="brand site-brand">
          {brandLabel}
        </Link>
        <div className="top-end">{headerEnd}</div>
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
        headerEnd={<ThemeToggle />}
        footerLabel="Admin sign-in · VGMGC"
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
        footerLabel="VGMGC administration"
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
      footerLabel="Contest moderation · VGMGC"
    />
  )
}
