import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle(pageTitle('Not found'))

  return (
    <div className="page">
      <h1>Page not found</h1>
      <p className="muted">The page you requested does not exist.</p>
      <p className="muted small">
        <Link to="/">Home</Link>
      </p>
    </div>
  )
}
