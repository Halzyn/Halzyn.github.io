import type { SupabaseClient } from '@supabase/supabase-js'

export function invokeContestPublishedNotify(client: SupabaseClient, contestId: string): void {
  void client.functions.invoke('contest-published-notify', { body: { contest_id: contestId } }).then(({ error }) => {
    if (error) {
      console.warn('contest-published-notify:', error.message)
    }
  })
}
