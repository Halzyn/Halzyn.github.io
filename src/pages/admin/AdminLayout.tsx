import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'

export function AdminLayout() {
  const loc = useLocation()
  const isLogin = loc.pathname.replace(/\/$/, '') === '/admin/login'

  const [session, setSession] = useState<Session | null>(null)
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      setAdmin(null)
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) {
        setAdmin(false)
        return
      }
      setAdmin(Boolean(data?.is_admin))
    })()
  }, [session])

  if (!supabaseConfigured) {
    return <p className="banner warn">Supabase is not configured.</p>
  }
  if (loading) {
    return <p className="muted">Loading…</p>
  }

  if (isLogin) {
    return <Outlet />
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  }
  if (admin === false) {
    return <p className="banner warn">This account is not an admin.</p>
  }
  if (admin === null) {
    return <p className="muted">Checking permissions…</p>
  }

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <strong>Admin</strong>
        <nav className="admin-nav">
          <Link to="/admin/contests">Contests</Link>
          <Link to="/">Site</Link>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              void supabase?.auth.signOut()
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
