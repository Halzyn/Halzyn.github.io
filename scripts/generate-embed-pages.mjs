import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  applyPageMetaToHtml,
  contestPageMeta,
  contestsListMeta,
  gamePageMeta,
  gamesListMeta,
  homePageMeta,
  profilePageMeta,
  profileRoleLabel,
  rulesPageMeta,
} from './siteMeta.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..')
const distDir = join(repoRoot, 'dist')

const MODERATOR_PROFILES_EMBED =
  'profiles(id, display_name, username, display_name_color, display_name_color_2, display_name_effect)'
const CONTEST_HOST_EMBED_SELECT = `contest_moderators(user_id, ${MODERATOR_PROFILES_EMBED}), contest_guest_hosts(id, display_name, sort_order)`

function extractRelationCount(relation) {
  if (!Array.isArray(relation) || relation.length === 0) return undefined
  const count = relation[0]?.count
  return typeof count === 'number' ? count : undefined
}

function computePpRankByUserId(players) {
  const ranked = players
    .filter((player) => typeof player.performance_points === 'number')
    .slice()
    .sort((left, right) => right.performance_points - left.performance_points)

  const ranks = new Map()
  for (let index = 0; index < ranked.length; index += 1) {
    ranks.set(ranked[index].id, index + 1)
  }
  return ranks
}

function avatarPublicUrl(supabaseUrl, avatarPath) {
  const cleaned = avatarPath?.trim()
  if (!cleaned) return null
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/avatars/${cleaned}`
}

async function writeEmbedPage(baseHtml, meta, routePath) {
  const html = applyPageMetaToHtml(baseHtml, meta)
  const outputPath = join(distDir, routePath, 'index.html')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html, 'utf8')
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

  const baseHtmlPath = join(distDir, 'index.html')
  const baseHtml = await readFile(baseHtmlPath, 'utf8')

  const homeMeta = homePageMeta()
  await writeFile(baseHtmlPath, applyPageMetaToHtml(baseHtml, homeMeta), 'utf8')
  await copyFile(baseHtmlPath, join(distDir, '404.html'))

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Skipping route-specific Discord embed pages: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const [
    { data: contests, error: contestsError },
    { data: games, error: gamesError },
    { data: players, error: playersError },
  ] = await Promise.all([
    supabase
      .from('contests')
      .select(`*, tracks(count), ${CONTEST_HOST_EMBED_SELECT}`)
      .order('deadline', { ascending: false }),
    supabase
      .from('games')
      .select(
        'id, primary_title, slug, cover_image_url, genres, platforms, release_date, description, track_game(count)',
      ),
    supabase.rpc('list_players_public'),
  ])

  if (contestsError) throw contestsError
  if (gamesError) throw gamesError
  if (playersError) throw playersError

  const contestRows = contests ?? []
  const gameRows = games ?? []
  const playerRows = players ?? []
  const ppRankByUserId = computePpRankByUserId(playerRows)

  await writeEmbedPage(baseHtml, contestsListMeta(contestRows.length), 'contests')
  await writeEmbedPage(baseHtml, gamesListMeta(gameRows.length), 'games')
  await writeEmbedPage(baseHtml, rulesPageMeta(), 'rules')

  for (const contest of contestRows) {
    await writeEmbedPage(
      baseHtml,
      contestPageMeta({ contest, trackCount: extractRelationCount(contest.tracks) }),
      `contests/${contest.slug}`,
    )
  }

  for (const game of gameRows) {
    await writeEmbedPage(
      baseHtml,
      gamePageMeta({
        game,
        trackCount: extractRelationCount(game.track_game),
      }),
      `games/${game.slug}`,
    )
  }

  for (const player of playerRows) {
    if (!player.username?.trim()) continue

    const { data: profilePayload } = await supabase.rpc('get_public_profile_page_data', {
      p_username: player.username,
    })
    const stats = profilePayload?.stats

    await writeEmbedPage(
      baseHtml,
      profilePageMeta({
        displayName: player.display_name,
        username: player.username,
        bio: player.bio,
        avatarUrl: avatarPublicUrl(supabaseUrl, player.avatar_path),
        level: stats?.rpg?.level,
        ppRank: ppRankByUserId.get(player.id) ?? null,
        performancePoints:
          typeof stats?.performance_points === 'number'
            ? stats.performance_points
            : typeof player.performance_points === 'number'
              ? player.performance_points
              : undefined,
        roleLabel: profileRoleLabel(player),
      }),
      `players/${player.username}`,
    )
  }

  console.log(
    `Generated Discord embed pages: home, contests (${contestRows.length}), games (${gameRows.length}), rules, profiles (${playerRows.length}).`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
