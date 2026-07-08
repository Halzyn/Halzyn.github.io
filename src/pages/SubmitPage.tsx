import { Navigate, useParams, useSearchParams } from 'react-router-dom'

export function SubmitPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  if (!slug) return null

  const query = searchParams.toString()
  const destination = query.length > 0 ? `/contests/${slug}?${query}` : `/contests/${slug}`

  return <Navigate to={destination} replace />
}
