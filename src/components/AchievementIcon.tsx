import type { ReactNode } from 'react'
import type { AchievementId, AchievementTier } from '../lib/profileAchievements'

type Props = {
  id: AchievementId
  className?: string
}

function SvgRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function AchievementIcon({ id, className }: Props) {
  switch (id) {
    case 'administrator':
      return (
        <SvgRoot className={className}>
          <path d="M12 3 4 7v6c0 4.2 3.2 7.4 8 9 4.8-1.6 8-4.8 8-9V7l-8-4Z" />
          <path d="M12 8v8M9 11h6" />
        </SvgRoot>
      )
    case 'host':
      return (
        <SvgRoot className={className}>
          <path d="M12 3 4 7v6c0 4.2 3.2 7.4 8 9 4.8-1.6 8-4.8 8-9V7l-8-4Z" />
          <path d="M8 11h8" />
        </SvgRoot>
      )
    case 'first_contest':
      return (
        <SvgRoot className={className}>
          <path d="M12 4v16" />
          <path d="M8 6 12 4l4 2" />
          <path d="M9 20h6" />
        </SvgRoot>
      )
    case 'regular':
      return (
        <SvgRoot className={className}>
          <circle cx="6" cy="14" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="10" cy="11" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="14" cy="11" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="18" cy="14" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="12" cy="17" r="1.25" fill="currentColor" stroke="none" />
        </SvgRoot>
      )
    case 'dedicated':
      return (
        <SvgRoot className={className}>
          <path d="M5 8h14v3H5z" />
          <path d="M7 11v3M17 11v3" />
          <path d="M9 14h6" />
        </SvgRoot>
      )
    case 'veteran':
      return (
        <SvgRoot className={className}>
          <path d="M6 14c2-4 4-6 6-8 2 2 4 4 6 8" />
          <path d="M5 14h14" />
        </SvgRoot>
      )
    case 'archivist':
      return (
        <SvgRoot className={className}>
          <path d="M5 8h14v10H5z" />
          <path d="M8 8V6h8v2" />
          <path d="M8 12h8M8 15h5" />
        </SvgRoot>
      )
    case 'champion':
      return (
        <SvgRoot className={className}>
          <path d="M5 16h14" />
          <path d="M7 16V9l5-3 5 3v7" />
          <path d="M9 9h6" />
        </SvgRoot>
      )
    case 'podium':
      return (
        <SvgRoot className={className}>
          <path d="M4 18h16" />
          <path d="M6 18V13h4v5M14 18V9h4v9" />
        </SvgRoot>
      )
    case 'contender':
      return (
        <SvgRoot className={className}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </SvgRoot>
      )
    case 'clean_sweep':
      return (
        <SvgRoot className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8 12 2.5 2.5L16 9" />
        </SvgRoot>
      )
    case 'high_score':
      return (
        <SvgRoot className={className}>
          <path d="M12 5v14" />
          <path d="M7 10l5-5 5 5" />
        </SvgRoot>
      )
    case 'sharp_ears':
      return (
        <SvgRoot className={className}>
          <path d="M4 14v-2c0-3 2-5 4-5s4 2 4 5v2" />
          <path d="M12 14v-2c0-3 2-5 4-5s4 2 4 5v2" />
          <path d="M8 17h8" />
        </SvgRoot>
      )
    case 'keen_ear_100':
    case 'keen_ear_250':
    case 'keen_ear_500':
      return (
        <SvgRoot className={className}>
          <path d="M5 13c0-3.5 2.5-6 5.5-6 1.8 0 3.3.9 4.2 2.2" />
          <path d="M19 13c0-3.5-2.5-6-5.5-6" />
          <path d="M4 14h16" />
          <path d="M7 17h10" />
        </SvgRoot>
      )
    case 'franchise_scout_10':
    case 'franchise_scout_50':
      return (
        <SvgRoot className={className}>
          <path d="M12 5v14" />
          <path d="M12 12H7M12 9h5" />
        </SvgRoot>
      )
    case 'lone_wolf':
      return (
        <SvgRoot className={className}>
          <path d="M12 6l1.8 3.6L18 10l-2.8 2.7.7 3.9L12 15l-3.9 1.6.7-3.9L6 10l4.2-.4L12 6Z" />
        </SvgRoot>
      )
    case 'solo_specialist_10':
    case 'solo_specialist_25':
      return (
        <SvgRoot className={className}>
          <path d="M12 5l1.5 3 3.3.5-2.4 2.3.6 3.3L12 13l-3 1.1.6-3.3-2.4-2.3 3.3-.5L12 5Z" />
          <circle cx="18" cy="18" r="2" />
        </SvgRoot>
      )
    case 'solo_ace':
      return (
        <SvgRoot className={className}>
          <path d="M12 4l1.4 2.8 3.1.5-2.2 2.1.5 3.1L12 11.8 9.2 12.5l.5-3.1-2.2-2.1 3.1-.5L12 4Z" />
          <circle cx="7" cy="18" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </SvgRoot>
      )
    case 'hard_mode':
      return (
        <SvgRoot className={className}>
          <path d="M7 17V13M12 17V9M17 17V11" />
        </SvgRoot>
      )
    case 'insane_slayer':
      return (
        <SvgRoot className={className}>
          <path d="M13 3 8 13h4l-1 8 6-12h-4l0-6Z" />
        </SvgRoot>
      )
    case 'insane_master':
      return (
        <SvgRoot className={className}>
          <path d="M10 3 6 13h3l-1 8 5-10h-3l0-8Z" />
          <path d="M16 5l-2 8h2l-1 6 3-8h-2l0-6Z" />
        </SvgRoot>
      )
    case 'jokes_on_you':
      return (
        <SvgRoot className={className}>
          <path d="M8 14c1.5 2 6.5 2 8 0" />
          <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
        </SvgRoot>
      )
    case 'level_10':
      return (
        <SvgRoot className={className}>
          <path d="M12 4 6 8v8l6 4 6-4V8l-6-4Z" />
          <path d="M10 12h4" />
        </SvgRoot>
      )
    case 'level_25':
      return (
        <SvgRoot className={className}>
          <path d="M12 4 6 8v8l6 4 6-4V8l-6-4Z" />
          <path d="M9 12h6M9 15h6" />
        </SvgRoot>
      )
    case 'level_50':
      return (
        <SvgRoot className={className}>
          <path d="M12 3 5 7v10l7 4 7-4V7l-7-4Z" />
          <path d="M9 11h6M9 14h6" />
        </SvgRoot>
      )
    case 'pp_elite':
      return (
        <SvgRoot className={className}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </SvgRoot>
      )
    case 'pp_contender':
      return (
        <SvgRoot className={className}>
          <path d="M12 6v12" />
          <path d="M8 10l4-4 4 4" />
        </SvgRoot>
      )
    case 'wealthy_adventurer':
      return (
        <SvgRoot className={className}>
          <ellipse cx="12" cy="14" rx="6" ry="2" />
          <ellipse cx="12" cy="11" rx="5" ry="1.8" />
          <ellipse cx="12" cy="8" rx="4" ry="1.5" />
        </SvgRoot>
      )
    case 'soundtrack_soul':
      return (
        <SvgRoot className={className}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        </SvgRoot>
      )
    case 'face_card':
      return (
        <SvgRoot className={className}>
          <rect x="6" y="5" width="12" height="14" rx="1.5" />
          <circle cx="12" cy="11" r="2.5" />
          <path d="M9 16c.8 1 4.2 1 6 0" />
        </SvgRoot>
      )
    case 'wordsmith':
      return (
        <SvgRoot className={className}>
          <path d="M6 18l8-8 2 2-8 8H6v-2Z" />
          <path d="M14 8l2 2" />
        </SvgRoot>
      )
    default:
      return (
        <SvgRoot className={className}>
          <circle cx="12" cy="12" r="6" />
        </SvgRoot>
      )
  }
}

export function achievementTierClass(tier: AchievementTier): string {
  return `profile-achievement-badge--${tier}`
}
