import { useCallback, useEffect, useRef } from 'react'
import { applyDraftLoadPatch, loadContestDraft } from '../lib/loadContestDraft'
import { getSupabase } from '../lib/supabase'
import type { Contest, Track } from '../lib/types'

type UseContestDraftLoadParams = {
  contest: Contest
  tracks: Track[]
  slug: string
  trackIdsKey: string
  adminSubmissionId: string
  urlEditToken: string
  anonymousEditToken: string
  sessionUserId: string | null
  userId: string | null
  isAdmin: boolean
  ready: boolean
  profileDisplayNameForSubmit: string | null
  setDraftLoading: (value: boolean) => void
  setPageError: (value: string | null) => void
  setNameReadOnly: (value: boolean) => void
  setUseAdminApi: (value: boolean) => void
  setName: (value: string) => void
  setGuesses: (value: Record<string, string>) => void
  setHasSubmission: (value: boolean) => void
  setEditSubmissionUserId: (value: string | null) => void
  setOwnerClosedOutcome: (value: 'unset' | 'none' | 'readonly') => void
  commitSavedSnapshot: (name: string, guesses: Record<string, string>) => void
}

export function useContestDraftLoad(params: UseContestDraftLoadParams): {
  invalidateDraftLoad: () => void
} {
  const loadedDraftKeyRef = useRef<string | null>(null)
  const supabase = getSupabase()

  const {
    contest,
    tracks,
    slug,
    trackIdsKey,
    adminSubmissionId,
    urlEditToken,
    anonymousEditToken,
    sessionUserId,
    userId,
    isAdmin,
    ready,
    profileDisplayNameForSubmit,
    setDraftLoading,
    setPageError,
    setNameReadOnly,
    setUseAdminApi,
    setName,
    setGuesses,
    setHasSubmission,
    setEditSubmissionUserId,
    setOwnerClosedOutcome,
    commitSavedSnapshot,
  } = params

  const invalidateDraftLoad = useCallback(() => {
    loadedDraftKeyRef.current = null
  }, [])

  useEffect(() => {
    loadedDraftKeyRef.current = null
  }, [contest.id, trackIdsKey])

  useEffect(() => {
    if (tracks.length === 0) return

    const loadKey = [
      contest.id,
      trackIdsKey,
      adminSubmissionId,
      urlEditToken,
      anonymousEditToken,
      sessionUserId ?? '',
      isAdmin ? '1' : '0',
      ready ? '1' : '0',
    ].join('|')

    if (loadedDraftKeyRef.current === loadKey) return
    let cancelled = false

    async function run() {
      setDraftLoading(true)
      setPageError(null)

      try {
        const result = await loadContestDraft({
          supabase,
          contest,
          tracks,
          slug,
          loadKey,
          adminSubmissionId,
          urlEditToken,
          anonymousEditToken,
          sessionUserId,
          userId,
          isAdmin,
          ready,
          profileDisplayNameForSubmit,
        })

        if (cancelled || result.kind === 'abort') return

        applyDraftLoadPatch(result.patch, slug, {
          setPageError,
          setNameReadOnly,
          setUseAdminApi,
          setName,
          setGuesses,
          setHasSubmission,
          setEditSubmissionUserId,
          setOwnerClosedOutcome,
          commitSavedSnapshot,
        })
        loadedDraftKeyRef.current = loadKey
      } finally {
        if (!cancelled) setDraftLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    adminSubmissionId,
    anonymousEditToken,
    commitSavedSnapshot,
    contest,
    isAdmin,
    profileDisplayNameForSubmit,
    ready,
    sessionUserId,
    setDraftLoading,
    setEditSubmissionUserId,
    setGuesses,
    setHasSubmission,
    setName,
    setNameReadOnly,
    setOwnerClosedOutcome,
    setPageError,
    setUseAdminApi,
    slug,
    supabase,
    trackIdsKey,
    tracks,
    urlEditToken,
    userId,
  ])

  return { invalidateDraftLoad }
}
