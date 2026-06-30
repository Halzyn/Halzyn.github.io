import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { pickRandomHeaderLogo } from '../lib/headerLogos'

type Props = {
  to: string
  label?: string
  children?: ReactNode
  className?: string
}

export function HeaderBrand({ to, label = 'VGMGC', children, className = 'brand site-brand site-brand-mark' }: Props) {
  const [logoSrc] = useState(pickRandomHeaderLogo)

  return (
    <Link to={to} className={className} aria-label={label}>
      <img src={logoSrc} alt="" className="site-brand-logo" height={36} decoding="async" />
      {children}
    </Link>
  )
}
