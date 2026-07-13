import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { isProfileNavActive, siteNavLinkClass } from '../lib/siteNav'

type Props = {
  profileTo: string
}

export function ProfileNavDropdown({ profileTo }: Props) {
  const location = useLocation()
  const { hasModerationAccess } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const menuId = useId()
  const profileActive = isProfileNavActive(location.pathname, profileTo)

  const close = useCallback(() => setOpen(false), [])

  useEscapeKey(open, close)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && !root.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  return (
    <span className="profile-nav-dropdown" ref={rootRef}>
      <Link
        to={profileTo}
        className={siteNavLinkClass(profileActive)}
        aria-current={profileActive ? 'page' : undefined}
      >
        Profile
      </Link>
      <button
        type="button"
        className="profile-nav-dropdown-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title="Profile menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="profile-nav-dropdown-caret" aria-hidden />
      </button>
      {open ? (
        <div id={menuId} className="profile-nav-dropdown-menu" role="menu">
          <Link to="/profile/edit" role="menuitem" onClick={close}>
            Edit profile
          </Link>
          <Link to="/profile/edit?tab=submissions" role="menuitem" onClick={close}>
            My submissions
          </Link>
          {hasModerationAccess ? (
            <Link to="/profile/edit?tab=moderation" role="menuitem" onClick={close}>
              Moderation
            </Link>
          ) : null}
        </div>
      ) : null}
    </span>
  )
}
