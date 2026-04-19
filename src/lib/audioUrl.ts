import { supabase } from './supabase'

export function publicAudioUrl(audioPath: string): string | null {
  if (!supabase) return null
  const { data } = supabase.storage.from('contest-audio').getPublicUrl(audioPath)
  return data.publicUrl
}
