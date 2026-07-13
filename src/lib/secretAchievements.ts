import { getSupabase } from './supabase'
import type { AchievementId } from './profileAchievements'

export const STORAGE_SECRET_ACHIEVEMENTS = 'vgmgc-secret-achievements'
export const SECRET_ACHIEVEMENT_UNLOCKED_EVENT = 'vgmgc-secret-achievement-unlocked'

export const BILL_RIZER_ACHIEVEMENT_ID = 'bill_rizer' satisfies AchievementId

type SecretAchievementStore = Record<string, AchievementId[]>

function readStore(): SecretAchievementStore {
  try {
    const raw = localStorage.getItem(STORAGE_SECRET_ACHIEVEMENTS)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as SecretAchievementStore
  } catch {
    return {}
  }
}

function writeStore(store: SecretAchievementStore): void {
  try {
    localStorage.setItem(STORAGE_SECRET_ACHIEVEMENTS, JSON.stringify(store))
  } catch {
    return
  }
}

export function readLocalSecretAchievements(profileId: string): AchievementId[] {
  const ids = readStore()[profileId]
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is AchievementId => typeof id === 'string')
}

export function hasLocalSecretAchievement(profileId: string, achievementId: AchievementId): boolean {
  return readLocalSecretAchievements(profileId).includes(achievementId)
}

export function writeLocalSecretAchievement(profileId: string, achievementId: AchievementId): boolean {
  const store = readStore()
  const existing = store[profileId] ?? []
  if (existing.includes(achievementId)) return false
  store[profileId] = [...existing, achievementId]
  writeStore(store)
  window.dispatchEvent(
    new CustomEvent(SECRET_ACHIEVEMENT_UNLOCKED_EVENT, {
      detail: { profileId, achievementId },
    }),
  )
  return true
}

export function mergeSecretAchievementIds(
  profileId: string,
  serverIds: string[] | null | undefined,
): AchievementId[] {
  const merged = new Set<AchievementId>()
  for (const id of serverIds ?? []) {
    if (typeof id === 'string' && id.length > 0) merged.add(id as AchievementId)
  }
  for (const id of readLocalSecretAchievements(profileId)) {
    merged.add(id)
  }
  return [...merged]
}

export async function unlockSecretAchievementOnServer(achievementId: string): Promise<boolean> {
  const { error } = await getSupabase().rpc('unlock_secret_achievement', {
    p_achievement_id: achievementId,
  })
  return !error
}
