export const SITE_URL = 'https://vgmgc.fun'
export const SITE_NAME = 'VGMGC'
export const DEFAULT_OG_IMAGE_PATH = '/supermariokart-light.png'

function pageTitle(...segments) {
  const parts = segments.map((segment) => segment.trim()).filter(Boolean)
  return [...parts, SITE_NAME].join(' / ')
}

export function absoluteSiteUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${normalized}`
}

export function defaultOgImage() {
  return absoluteSiteUrl(DEFAULT_OG_IMAGE_PATH)
}

export function truncateDescription(text, max = 300) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function firstOf(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function hostDisplayLabel(displayName, username) {
  const display = displayName?.trim()
  if (display) return display
  const user = username?.trim()
  if (user) return user
  return 'Player'
}

function hostNamesFromContest(contest) {
  const names = []
  const modRows = [...(contest.contest_moderators ?? [])]
  modRows.sort((a, b) => {
    const left = hostDisplayLabel(firstOf(a.profiles)?.display_name, firstOf(a.profiles)?.username)
    const right = hostDisplayLabel(firstOf(b.profiles)?.display_name, firstOf(b.profiles)?.username)
    return left.toLowerCase().localeCompare(right.toLowerCase())
  })
  for (const row of modRows) {
    const profile = firstOf(row.profiles)
    names.push(hostDisplayLabel(profile?.display_name, profile?.username))
  }

  const guestRows = [...(contest.contest_guest_hosts ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
  })
  for (const guest of guestRows) {
    names.push(guest.display_name.trim() || 'Player')
  }

  return names
}

function hostPhrase(hostNames) {
  if (hostNames.length === 0) return null
  if (hostNames.length === 1) return `Hosted by ${hostNames[0]}`
  if (hostNames.length === 2) return `Hosted by ${hostNames[0]} and ${hostNames[1]}`
  return `Hosted by ${hostNames.slice(0, -1).join(', ')}, and ${hostNames[hostNames.length - 1]}`
}

function formatDeadline(deadlineIso) {
  return new Date(deadlineIso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function contestClosed(deadlineIso) {
  return Date.parse(deadlineIso) <= Date.now()
}

export function homePageMeta() {
  return {
    title: pageTitle('Home'),
    description:
      'Video game music guessing contests. Name the game from 30-second song snippets or browse the archive and check out the old contests.',
    url: absoluteSiteUrl('/'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function contestsListMeta(contestCount) {
  const countPhrase =
    typeof contestCount === 'number' && contestCount > 0
      ? `${contestCount} contest${contestCount === 1 ? '' : 's'} in the archive. `
      : ''
  return {
    title: pageTitle('Contests'),
    description: truncateDescription(`${countPhrase}Browse every VGMGC: open entries and past results.`),
    url: absoluteSiteUrl('/contests'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function gamesListMeta(gameCount) {
  const countPhrase =
    typeof gameCount === 'number' && gameCount > 0
      ? `${gameCount} games featured across past contests. `
      : ''
  return {
    title: pageTitle('Games'),
    description: truncateDescription(
      `${countPhrase}Explore the full catalog of games that have appeared in VGMGCs, with metadata and track history for each title.`,
    ),
    url: absoluteSiteUrl('/games'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function rulesPageMeta() {
  return {
    title: pageTitle('Rules'),
    description: truncateDescription('Discover how to play and participate in a VGMGC.'),
    url: absoluteSiteUrl('/rules'),
    image: defaultOgImage(),
    type: 'website',
  }
}

export function contestPageMeta({ contest, trackCount }) {
  const closed = contestClosed(contest.deadline)
  const hosts = hostPhrase(hostNamesFromContest(contest))
  const parts = []

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

export function gamePageMeta({ game, trackCount, contestCount }) {
  const parts = []

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

export function profilePageMeta(input) {
  const parts = []

  if (input.roleLabel) parts.push(input.roleLabel)
  if (typeof input.level === 'number') parts.push(`Level ${input.level}`)
  if (input.ppRank != null) parts.push(`Rank #${input.ppRank}`)
  if (typeof input.performancePoints === 'number') {
    parts.push(`${input.performancePoints.toFixed(2)} performance points`)
  }

  const statsPhrase = parts.length > 0 ? `${parts.join(' · ')}.` : ''
  const bioPhrase = input.bio?.trim() ? input.bio.trim() : 'VGMGC contestant profile with stats and achievements.'

  return {
    title: pageTitle(input.displayName),
    description: truncateDescription(`${statsPhrase} ${bioPhrase}`.trim()),
    url: absoluteSiteUrl(`/players/${encodeURIComponent(input.username)}`),
    image: input.avatarUrl?.trim() || defaultOgImage(),
    type: 'profile',
  }
}

export function profileRoleLabel(profile) {
  if (profile.is_admin) return 'Administrator'
  if (profile.is_contest_moderator) return 'Contest Moderator'
  return 'Contestant'
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeMetaContent(text) {
  return text.replace(/"/g, '&quot;')
}

function renderPageMetaTags(meta) {
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

function stripExistingMetaTags(html) {
  return html
    .replace(/\s*<meta\b[\s\S]*?\/>/g, (match) =>
      /\bname="description"|\bproperty="og:|\bname="twitter:/.test(match) ? '' : match,
    )
    .replace(/\s*<link\b[\s\S]*?\brel="canonical"[\s\S]*?\/>/g, '')
}

export function applyPageMetaToHtml(baseHtml, meta) {
  const tags = renderPageMetaTags(meta)
  const withoutExisting = stripExistingMetaTags(baseHtml)

  return withoutExisting
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace('<head>', `<head>\n    ${tags}`)
}
