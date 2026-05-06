import { getSupabase } from './supabase'

export function authRedirectUrl(path: string): string {
  if (typeof window === 'undefined') return path
  const base = import.meta.env.BASE_URL || '/'
  const root = `${window.location.origin}${base}`.replace(/\/?$/, '/')
  const cleanedPath = path.replace(/^\//, '')
  return `${root}${cleanedPath}`
}

export async function signOutAndReloadHome(): Promise<void> {
  await getSupabase().auth.signOut({ scope: 'global' })
  const base = import.meta.env.BASE_URL || '/'
  window.location.href = `${window.location.origin}${base}`
}
