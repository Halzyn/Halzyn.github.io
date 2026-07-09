import type { SupabaseClient } from '@supabase/supabase-js'

export type ModeratedContest = { id: string; slug: string; title: string }

function collectModeratedContestsFromRows(
  rows: { contests: ModeratedContest | ModeratedContest[] | null }[],
): ModeratedContest[] {
  const list: ModeratedContest[] = []
  const seenIds = new Set<string>()
  for (const row of rows) {
    const embedded = row.contests
    if (!embedded) continue
    for (const contest of Array.isArray(embedded) ? embedded : [embedded]) {
      if (contest?.id && !seenIds.has(contest.id)) {
        seenIds.add(contest.id)
        list.push(contest)
      }
    }
  }
  list.sort((a, b) => a.title.localeCompare(b.title))
  return list
}

export async function fetchModeratedContests(
  client: SupabaseClient,
  userId: string,
): Promise<ModeratedContest[]> {
  const { data, error } = await client
    .from('contest_moderators')
    .select('contest_id, contests ( id, slug, title )')
    .eq('user_id', userId)
  if (error || !data) return []
  return collectModeratedContestsFromRows(
    data as { contests: ModeratedContest | ModeratedContest[] | null }[],
  )
}
