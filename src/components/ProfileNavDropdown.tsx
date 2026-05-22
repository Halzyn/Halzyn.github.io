import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  profileTo: string
}

export function ProfileNavDropdown({ profileTo }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && !root.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <span className="profile-nav-dropdown" ref={rootRef}>
      <Link to={profileTo}>Profile</Link>
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
        </div>
      ) : null}
    </span>
  )
}
