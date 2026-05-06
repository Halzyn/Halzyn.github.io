import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const allow =
    origin && /^https?:\/\/.+/i.test(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function sanitizeSearchPhrase(title: string): string {
  return title
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, '')
    .replace(/;/g, ' ')
    .trim()
    .slice(0, 220)
}

function namesFromExpanded(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const x of arr) {
    if (x && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string') {
      const n = ((x as { name: string }).name || '').trim()
      if (n) out.push(n)
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function coverImageUrl(cover: unknown): string | null {
  if (!cover || typeof cover !== 'object') return null
  const o = cover as { image_id?: unknown; url?: unknown }
  if (typeof o.url === 'string' && o.url.trim()) {
    let u = o.url.trim()
    if (u.startsWith('//')) u = `https:${u}`
    return u.replace('/t_thumb/', '/t_cover_big/').replace('/t_screenshot_med/', '/t_cover_big/')
  }
  if (typeof o.image_id === 'string' && o.image_id.trim()) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big/${o.image_id.trim()}.jpg`
  }
  return null
}

function mapHit(hit: Record<string, unknown>) {
  const igdbId = typeof hit.id === 'number' ? hit.id : typeof hit.id === 'string' ? Number(hit.id) : NaN
  const igdbName = typeof hit.name === 'string' ? hit.name : null
  if (!Number.isFinite(igdbId)) return null

  const summary = typeof hit.summary === 'string' ? hit.summary.trim() : ''
  const storyline = typeof hit.storyline === 'string' ? hit.storyline.trim() : ''
  const description = (summary || storyline || null) as string | null

  const frd = hit.first_release_date
  let release_date: string | null = null
  if (typeof frd === 'number' && Number.isFinite(frd)) {
    const ms = frd > 10_000_000_000 ? frd : frd * 1000
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) release_date = d.toISOString().slice(0, 10)
  } else if (typeof frd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(frd)) {
    release_date = frd.slice(0, 10)
  }

  const genres = namesFromExpanded(hit.genres)
  const platforms = namesFromExpanded(hit.platforms)
  const cover_image_url = coverImageUrl(hit.cover)

  return {
    igdb_id: igdbId,
    igdb_name: igdbName,
    cover_image_url,
    genres,
    platforms,
    release_date,
    description,
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const twitchId = Deno.env.get('TWITCH_CLIENT_ID')
  const twitchSecret = Deno.env.get('TWITCH_CLIENT_SECRET')

  if (!supabaseUrl || !anonKey) {
    return json(req, 500, { error: 'Missing Supabase environment (URL or anon key).' })
  }
  if (!twitchId || !twitchSecret) {
    return json(req, 500, {
      error:
        'Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET. Register an app at https://dev.twitch.tv and enable IGDB API.',
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(req, 401, { error: 'Missing or invalid Authorization header.' })
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser()
  if (userErr || !user) return json(req, 401, { error: 'Invalid session.' })

  const { data: profile, error: profErr } = await supabaseUser
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !profile?.is_admin) return json(req, 403, { error: 'Admin only.' })

  let body: { game_id?: string; igdb_id?: unknown; search_title?: string | null }
  try {
    body = (await req.json()) as { game_id?: string; igdb_id?: unknown; search_title?: string | null }
  } catch {
    return json(req, 400, { error: 'Invalid JSON body.' })
  }

  const gameId = body.game_id?.trim()
  if (!gameId || !UUID_RE.test(gameId)) return json(req, 400, { error: 'Invalid game_id.' })

  const { data: gameRow, error: gErr } = await supabaseUser
    .from('games')
    .select('id, primary_title')
    .eq('id', gameId)
    .maybeSingle()

  if (gErr) return json(req, 500, { error: gErr.message })
  if (!gameRow) return json(req, 404, { error: 'Game not found.' })

  const primaryTitle = String(gameRow.primary_title || '').trim()

  let igdbIdArg: number | null = null
  if (body.igdb_id != null && body.igdb_id !== '') {
    const n = typeof body.igdb_id === 'number' ? body.igdb_id : Number(body.igdb_id)
    if (Number.isInteger(n) && n > 0 && n <= 2_147_483_647) igdbIdArg = n
    else return json(req, 400, { error: 'Invalid igdb_id (use a positive integer).' })
  }

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: twitchId,
      client_secret: twitchSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!tokenRes.ok) {
    const t = await tokenRes.text()
    return json(req, 502, { error: `Twitch token error (${tokenRes.status}): ${t.slice(0, 200)}` })
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  const accessToken = tokenJson.access_token
  if (!accessToken) return json(req, 502, { error: 'Twitch token response missing access_token.' })

  const fields =
    'fields id,name,summary,storyline,first_release_date,cover.image_id,cover.url,genres.name,platforms.name;\n'

  let igdbBody: string
  if (igdbIdArg != null) {
    igdbBody = `${fields}where id = ${igdbIdArg};\nlimit 1;\n`
  } else {
    const searchSource = (typeof body.search_title === 'string' ? body.search_title : primaryTitle).trim()
    const phrase = sanitizeSearchPhrase(searchSource)
    if (!phrase) {
      return json(req, 400, {
        error:
          'No search text: set optional IGDB id, or provide a primary title / search title to search IGDB.',
      })
    }
    igdbBody = `search "${phrase}";\n${fields}limit 5;\n`
  }

  const igdbRes = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Client-ID': twitchId,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: igdbBody,
  })

  if (!igdbRes.ok) {
    const t = await igdbRes.text()
    return json(req, 502, { error: `IGDB error (${igdbRes.status}): ${t.slice(0, 300)}` })
  }

  const hits = (await igdbRes.json()) as unknown[]
  if (!Array.isArray(hits) || hits.length === 0) {
    const hint = igdbIdArg != null ? `id ${igdbIdArg}` : 'that search'
    return json(req, 404, { error: `No IGDB game found for ${hint}.` })
  }

  const hit = hits[0] as Record<string, unknown>
  const preview = mapHit(hit)
  if (!preview) return json(req, 502, { error: 'IGDB response missing game id.' })

  return json(req, 200, { preview })
})
