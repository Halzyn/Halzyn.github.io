import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="shell">
      <header className="top">
        <Link to="/" className="brand">
          Halzyn
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/contests">Contests</Link>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="foot">
        <span>VGM guessing contests</span>
      </footer>
    </div>
  )
}
