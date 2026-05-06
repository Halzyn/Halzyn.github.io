import type { SupabaseClient } from '@supabase/supabase-js'

async function ensureGameId(
  supabase: SupabaseClient,
  trackId: string,
  title: string,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.rpc('ensure_game_by_title', {
    p_title: title,
    p_track_id: trackId,
  })
  if (error) return { error: error.message }
  return { id: data as string }
}

export async function syncTrackGameAssignments(
  supabase: SupabaseClient,
  trackId: string,
  primaryTitle: string,
  sharedTitles: string[],
): Promise<{ error: string | null }> {
  const primary = await ensureGameId(supabase, trackId, primaryTitle)
  if ('error' in primary) return primary

  const { error: deletionError } = await supabase.from('track_game').delete().eq('track_id', trackId)
  if (deletionError) return { error: deletionError.message }

  const { error: insertError } = await supabase.from('track_game').insert({
    track_id: trackId,
    game_id: primary.id,
    link_kind: 'primary',
  })
  if (insertError) return { error: insertError.message }

  const rows: { track_id: string; game_id: string; link_kind: 'shared_music' }[] = []
  const seen = new Set<string>([primary.id])
  for (const title of sharedTitles) {
    const game = await ensureGameId(supabase, trackId, title)
    if ('error' in game) return game
    if (seen.has(game.id)) continue
    seen.add(game.id)
    rows.push({ track_id: trackId, game_id: game.id, link_kind: 'shared_music' })
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('track_game').insert(rows)
    if (insertError) return { error: insertError.message }
  }

  return { error: null }
}
