import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const AUTH = { persistSession: true, autoRefreshToken: true } as const

export let supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase client is not initialized')
  return supabase
}

export function ensureSupabase(): void {
  if (supabase) return
  supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: AUTH },
  )
}
