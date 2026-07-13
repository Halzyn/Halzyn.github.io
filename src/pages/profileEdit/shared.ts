import type { DisplayNameEffect, SiteBackgroundPattern } from '../../lib/types'

export type EditTab = 'basic' | 'private' | 'submissions' | 'appearance' | 'fun' | 'moderation'

export type MyContestSubmissionRow = {
  submission_id: string
  contest_id: string
  contest_slug: string
  contest_title: string
  deadline: string
  results_published: boolean
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/

export const PROFILE_SECTION_TABS: { tab: EditTab; label: string }[] = [
  { tab: 'basic', label: 'Profile' },
  { tab: 'private', label: 'Private info' },
  { tab: 'submissions', label: 'Submissions' },
  { tab: 'appearance', label: 'Site settings' },
  { tab: 'fun', label: 'Fun' },
]

export const SITE_BACKGROUND_OPTIONS: {
  value: Exclude<SiteBackgroundPattern, 'none'>
  label: string
}[] = [
  { value: 'candycavios', label: 'Candy Mountain / Planet Cavios' },
  { value: 'cutestripes', label: 'Cute Stripes' },
  { value: 'dk64', label: 'Donkey Kong 64' },
  { value: 'furnacefun', label: "Grunty's Furnace Fun" },
  { value: 'miningmelancholy', label: 'Mining Melancholy' },
  { value: 'outer_wall', label: 'Outer Wall' },
  { value: 'smwc', label: 'SMWCentral' },
  { value: 'supermariokart', label: 'Super Mario Kart' },
]

export const NAME_EFFECT_OPTIONS: { value: DisplayNameEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'outline', label: 'Outline' },
  { value: 'drop_shadow', label: 'Drop shadow' },
  { value: 'glow', label: 'Glow' },
]

export const NAME_COLOR_FALLBACK = '#4488cc'

export function parseEditTab(value: string | null): EditTab | null {
  if (
    value === 'basic' ||
    value === 'private' ||
    value === 'submissions' ||
    value === 'appearance' ||
    value === 'fun' ||
    value === 'moderation'
  ) {
    return value
  }
  return null
}
