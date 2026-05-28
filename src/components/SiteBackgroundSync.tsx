import { useLayoutEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  applySiteBackgroundPattern,
  DEFAULT_SITE_BACKGROUND_PATTERN,
  parseSiteBackgroundPattern,
} from '../theme/siteBackground'

export function SiteBackgroundSync() {
  const { profile, ready } = useAuth()

  useLayoutEffect(() => {
    if (!ready) {
      applySiteBackgroundPattern(DEFAULT_SITE_BACKGROUND_PATTERN)
      return
    }
    applySiteBackgroundPattern(parseSiteBackgroundPattern(profile?.site_background_pattern))
  }, [ready, profile?.site_background_pattern])

  return null
}
