import { isPast, parseISO } from 'date-fns'
import { buildContestHostsFromEmbed } from './contestHosts'
import { pageTitle, SITE_TITLE } from './pageTitle'
import type { ContestWithHosts, Game } from './types'

export const SITE_URL = 'https://vgmgc.fun'
export const SITE_NAME = SITE_TITLE
export const DEFAULT_OG_IMAGE_PATH = '/supermariokart-light.png'

export type PageMeta = {
  title: string
  description: string
  url: string
  image?: string
  type?: 'website' | 'article' | 'profile'
}

export function absoluteSiteUrl(path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${normalized}`
}

export function defaultOgImage(): string {
  return absoluteSiteUrl(DEFAULT_OG_IMAGE_PATH)
}

export function truncateDescription(text: string, max = 300): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function hostNamesFromContest(contest: ContestWithHosts): string[] {
  return buildContestHostsFromEmbed(contest).entries.map((entry) => entry.displayName)
}

function hostPhrase(hostNames: string[]): string | null {
  if (hostNames.length === 0) return null
  if (hostNames.length === 1) return `Hosted by ${hostNames[0]}`
  if (hostNames.length === 2) return `Hosted by ${hostNames[0]} and ${hostNames[1]}`
  return `Hosted by ${hostNames.slice(0, -1).join(', ')}, and ${hostNames[hostNames.length - 1]}`
}

function formatDeadline(deadlineIso: string): string {
  return new Date(deadlineIso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function homePageMeta(): PageMeta {
  return {
    title: pageTitle('Home'),
    description:
      'Video game music guessing contests. Name the game from 30-second song snippets or browse the archive and check out the old contests.',
    url: absoluteSiteUrl('/'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function contestsListMeta(contestCount?: number): PageMeta {
  const countPhrase =
    typeof contestCount === 'number' && contestCount > 0
      ? `${contestCount} contest${contestCount === 1 ? '' : 's'} in the archive. `
      : ''
  return {
    title: pageTitle('Contests'),
    description: truncateDescription(
      `${countPhrase}Browse every VGMGC: open entries and past results.`,
    ),
    url: absoluteSiteUrl('/contests'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function tracksListMeta(trackCount?: number): PageMeta {
  const countPhrase =
    typeof trackCount === 'number' && trackCount > 0
      ? `${trackCount} contest track${trackCount === 1 ? '' : 's'}. `
      : ''
  return {
    title: pageTitle('Tracks'),
    description: truncateDescription(
      `${countPhrase}Browse every track from past VGMGCs!`,
    ),
    url: absoluteSiteUrl('/tracks'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function gamesListMeta(gameCount?: number): PageMeta {
  const countPhrase =
    typeof gameCount === 'number' && gameCount > 0
      ? `${gameCount} games featured across past contests. `
      : ''
  return {
    title: pageTitle('Games'),
    description: truncateDescription(
      `${countPhrase}Explore the full catalog of games that have appeared in VGMGCs.`,
    ),
    url: absoluteSiteUrl('/games'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function rulesPageMeta(): PageMeta {
  return {
    title: pageTitle('Rules'),
    description: truncateDescription(
      'Discover how to play and participate in a VGMGC.',
    ),
    url: absoluteSiteUrl('/rules'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function contestPageMeta(input: {
  contest: ContestWithHosts
  trackCount?: number
}): PageMeta {
  const { contest, trackCount } = input
  const closed = isPast(parseISO(contest.deadline))
  const hosts = hostPhrase(hostNamesFromContest(contest))
  const parts: string[] = []

  if (closed) {
    parts.push(
      contest.results_published
        ? 'Results are published for this VGMGC contest.'
        : 'This VGMGC contest has closed.',
    )
  } else {
    parts.push(`Open until ${formatDeadline(contest.deadline)}.`)
  }

  if (typeof trackCount === 'number' && trackCount > 0) {
    parts.push(`${trackCount} track${trackCount === 1 ? '' : 's'}.`)
  }

  if (hosts) parts.push(`${hosts}.`)

  if (contest.description?.trim()) {
    parts.push(contest.description.trim())
  } else {
    parts.push('Guess the games from video game music song snippets.')
  }

  return {
    title: pageTitle(contest.title),
    description: truncateDescription(parts.join(' ')),
    url: absoluteSiteUrl(`/contests/${encodeURIComponent(contest.slug)}`),
    image: defaultOgImage(),
    type: 'article',
  }
}

export function gamePageMeta(input: {
  game: Game
  trackCount?: number
  contestCount?: number
}): PageMeta {
  const { game, trackCount, contestCount } = input
  const parts: string[] = []

  if (game.release_date) {
    parts.push(
      `Released ${new Date(`${game.release_date}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`,
    )
  }

  if (game.genres?.length) {
    parts.push(`Genres: ${game.genres.join(', ')}.`)
  }

  if (game.platforms?.length) {
    parts.push(`Platforms: ${game.platforms.join(', ')}.`)
  }

  if (typeof contestCount === 'number' && contestCount > 0) {
    parts.push(`Featured in ${contestCount} VGMGC${contestCount === 1 ? '' : 's'}.`)
  }

  if (typeof trackCount === 'number' && trackCount > 0) {
    parts.push(`${trackCount} contest track${trackCount === 1 ? '' : 's'} listed.`)
  }

  if (game.description?.trim()) {
    parts.push(game.description.trim())
  } else {
    parts.push('View metadata and contest tracks for this game on VGMGC.')
  }

  return {
    title: pageTitle(game.primary_title),
    description: truncateDescription(parts.join(' ')),
    url: absoluteSiteUrl(`/games/${encodeURIComponent(game.slug)}`),
    image: game.cover_image_url?.trim() || defaultOgImage(),
    type: 'article',
  }
}

export function profilePageMeta(input: {
  displayName: string
  username: string
  bio?: string | null
  avatarUrl?: string | null
  level?: number
  ppRank?: number | null
  performancePoints?: number
  roleLabel?: string
}): PageMeta {
  const parts: string[] = []

  if (input.roleLabel) parts.push(input.roleLabel)
  if (typeof input.level === 'number') parts.push(`Level ${input.level}`)
  if (input.ppRank != null) parts.push(`Rank #${input.ppRank}`)
  if (typeof input.performancePoints === 'number') {
    parts.push(`${input.performancePoints.toFixed(2)}pp`)
  }

  const statsPhrase = parts.length > 0 ? `${parts.join(' ◦ ')}.` : ''
  const bioPhrase = input.bio?.trim() ? input.bio.trim() : 'VGMGC contestant profile with stats and achievements.'

  return {
    title: pageTitle(input.displayName),
    description: truncateDescription(`${statsPhrase} ${bioPhrase}`.trim()),
    url: absoluteSiteUrl(`/players/${encodeURIComponent(input.username)}`),
    image: input.avatarUrl?.trim() || defaultOgImage(),
    type: 'profile',
  }
}

export function profileRoleLabel(profile: {
  is_admin?: boolean
  is_contest_moderator?: boolean
}): string {
  if (profile.is_admin) return 'Administrator'
  if (profile.is_contest_moderator) return 'Contest Moderator'
  return 'Contestant'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeMetaContent(text: string): string {
  return text.replace(/"/g, '&quot;')
}

export function renderPageMetaTags(meta: PageMeta): string {
  const image = meta.image?.trim() || defaultOgImage()
  const type = meta.type ?? 'website'
  const tags = [
    `<meta name="description" content="${escapeMetaContent(meta.description)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${escapeMetaContent(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeMetaContent(meta.title)}" />`,
    `<meta property="og:description" content="${escapeMetaContent(meta.description)}" />`,
    `<meta property="og:url" content="${escapeMetaContent(meta.url)}" />`,
    `<meta property="og:image" content="${escapeMetaContent(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeMetaContent(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeMetaContent(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeMetaContent(image)}" />`,
    `<link rel="canonical" href="${escapeMetaContent(meta.url)}" />`,
  ]
  return tags.join('\n    ')
}

function stripExistingMetaTags(html: string): string {
  return html
    .replace(/\s*<meta\b[\s\S]*?\/>/g, (match) =>
      /\bname="description"|\bproperty="og:|\bname="twitter:/.test(match) ? '' : match,
    )
    .replace(/\s*<link\b[\s\S]*?\brel="canonical"[\s\S]*?\/>/g, '')
}

export function applyPageMetaToHtml(baseHtml: string, meta: PageMeta): string {
  const tags = renderPageMetaTags(meta)
  const withoutExisting = stripExistingMetaTags(baseHtml)

  return withoutExisting
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace('<head>', `<head>\n    ${tags}`)
}
