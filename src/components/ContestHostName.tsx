import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DisplayNameStyled } from './DisplayNameStyled'
import type { DisplayNameStyleInfo } from '../lib/displayNameStyle'

type Props = {
  displayName: string
  profileUsername: string | null
  styleInfo?: DisplayNameStyleInfo | null
  className?: string
  nestedInLink?: boolean
}

function profileHref(username: string): string {
  return `/players/${encodeURIComponent(username)}`
}

export function ContestHostName({
  displayName,
  profileUsername,
  styleInfo,
  className,
  nestedInLink = false,
}: Props) {
  const navigate = useNavigate()
  const name = <DisplayNameStyled text={displayName} info={styleInfo} className={className} />
  if (!profileUsername) return name

  if (nestedInLink) {
    const go = () => {
      void navigate(profileHref(profileUsername))
    }
    const onClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      go()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      e.stopPropagation()
      go()
    }
    return (
      <span
        role="link"
        tabIndex={0}
        className="contest-host-name-link"
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {name}
      </span>
    )
  }

  return (
    <Link to={profileHref(profileUsername)} className="contest-host-name-link">
      {name}
    </Link>
  )
}
