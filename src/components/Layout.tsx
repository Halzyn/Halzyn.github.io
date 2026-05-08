import { Link, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { AuthBar } from './AuthBar'

export function Layout() {
  return (
    <div className="shell site-shell">
      <div className="site-shell-panel">
        <header className="top site-topbar">
          <Link to="/" className="brand site-brand">
            VGMGC
          </Link>
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
            <span>Contests hosted by Halzyn (hazel) since 2016...</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
