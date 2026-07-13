import { useLayoutEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  applySiteBackgroundPattern,
  DEFAULT_SITE_BACKGROUND_PATTERN,
  parseSiteBackgroundPattern,
} from '../theme/siteBackground'

export function SiteBackgroundSync() {
  const { profile, profileReady } = useAuth()

  useLayoutEffect(() => {
    if (!profileReady) {
      applySiteBackgroundPattern(DEFAULT_SITE_BACKGROUND_PATTERN)
      return
    }
    applySiteBackgroundPattern(parseSiteBackgroundPattern(profile?.site_background_pattern))
  }, [profileReady, profile?.site_background_pattern])

  return null
}
