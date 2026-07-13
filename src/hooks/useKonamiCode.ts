import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { advanceKonamiProgress, isKonamiComplete, isKonamiKey } from '../lib/konamiCode'
import { playContraTheme, bindContraThemeVolumeSync, preloadContraTheme } from '../lib/playContraTheme'
import { queryKeys } from '../lib/queries/keys'
import {
  BILL_RIZER_ACHIEVEMENT_ID,
  unlockSecretAchievementOnServer,
  writeLocalSecretAchievement,
} from '../lib/secretAchievements'
import { useToast } from '../toast/ToastContext'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function useKonamiCode(): void {
  const { toast } = useToast()
  const { userId, profile } = useAuth()
  const queryClient = useQueryClient()
  const progressRef = useRef(0)
  const firingRef = useRef(false)

  const onComplete = useCallback(async () => {
    if (firingRef.current) return
    firingRef.current = true
    progressRef.current = 0

    playContraTheme()
    toast('TOASTY!!', { variant: 'success', durationMs: 2800 })

    if (userId) {
      writeLocalSecretAchievement(userId, BILL_RIZER_ACHIEVEMENT_ID)
      void unlockSecretAchievementOnServer(BILL_RIZER_ACHIEVEMENT_ID)
      if (profile?.username) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.publicProfile(profile.username) })
      }
    }

    window.setTimeout(() => {
      firingRef.current = false
    }, 600)
  }, [toast, userId, profile?.username, queryClient])

  useEffect(() => {
    preloadContraTheme()
    return bindContraThemeVolumeSync()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      if (!isKonamiKey(event)) {
        progressRef.current = 0
        return
      }

      const next = advanceKonamiProgress(progressRef.current, event)
      if (progressRef.current === 0 && next === 1) {
        preloadContraTheme()
      }
      progressRef.current = next

      if (isKonamiComplete(next)) {
        event.preventDefault()
        void onComplete()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onComplete])
}
