import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useContestDraftLoad } from './useContestDraftLoad'
import { contestClosed } from '../lib/deadline'
import {
  type SubmitContestPayload,
  contestEntryLoadErrorMessage,
  emptyGuessesForTracks,
  entrySnapshot,
  submissionIdFromSearchParam,
} from '../lib/contestEntry'
import {
  getStoredEditToken,
  setStoredContestEntry,
} from '../lib/contestEntryStorage'
import { getSupabase } from '../lib/supabase'
import type { Contest, Track } from '../lib/types'

type UseContestEntryOptions = {
  contest: Contest
  tracks: Track[]
  slug: string
}

export function useContestEntry({
  contest,
  tracks,
  slug,
}: UseContestEntryOptions) {
  const supabase = getSupabase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { ready, session, userId, isAdmin, profile } = useAuth()
  const urlEditToken = searchParams.get('edit') ?? ''
  const adminSubmissionId = useMemo(
    () => submissionIdFromSearchParam(searchParams.get('admin_submission')),
    [searchParams],
  )
  const storedEditToken = useMemo(() => getStoredEditToken(slug), [slug])
  const anonymousEditToken = userId ? '' : storedEditToken
  const trackIdsKey = useMemo(
    () => tracks.map((track) => track.id).join('\0'),
    [tracks],
  )
  const [name, setName] = useState('')
  const [guesses, setGuesses] = useState<Record<string, string>>(() =>
    emptyGuessesForTracks(tracks),
  )
  const [pageError, setPageError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [nameReadOnly, setNameReadOnly] = useState(false)
  const [useAdminApi, setUseAdminApi] = useState(false)
  const [ownerClosedOutcome, setOwnerClosedOutcome] = useState<
    'unset' | 'none' | 'readonly'
  >('unset')
  const [editSubmissionUserId, setEditSubmissionUserId] = useState<
    string | null | undefined
  >(undefined)
  const [claiming, setClaiming] = useState(false)
  const [hasSubmission, setHasSubmission] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const commitSavedSnapshot = useCallback(
    (entryName: string, entryGuesses: Record<string, string>) => {
      setSavedSnapshot(entrySnapshot(entryName, entryGuesses, tracks))
    },
    [tracks],
  )
  const profileDisplayNameForSubmit = useMemo(() => {
    const trimmed = profile?.display_name?.trim()
    return trimmed ? trimmed : null
  }, [profile?.display_name])

  const sessionUserId = session?.user?.id ?? null

  useEffect(() => {
    setName('')
    setGuesses(emptyGuessesForTracks(tracks))
    setPageError(null)
    setSaveNotice(null)
    setNameReadOnly(false)
    setUseAdminApi(false)
    setOwnerClosedOutcome('unset')
    setEditSubmissionUserId(undefined)
    setDraftLoading(false)
    setHasSubmission(false)
    setSavedSnapshot(null)
  }, [contest.id, trackIdsKey, tracks])

  useEffect(() => {
    if (!ready || urlEditToken || adminSubmissionId || !userId) return
    if (profileDisplayNameForSubmit) setName(profileDisplayNameForSubmit)
  }, [
    ready,
    urlEditToken,
    adminSubmissionId,
    userId,
    profileDisplayNameForSubmit,
  ])

  const { invalidateDraftLoad } = useContestDraftLoad({
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
  })

  const persistEditToken = useCallback(
    (token: string) => {
      if (!userId) setStoredContestEntry(slug, token)
      const params = new URLSearchParams(searchParams)
      params.set('edit', token)
      navigate(`/contests/${slug}?${params.toString()}`, { replace: true })
    },
    [navigate, searchParams, slug, userId],
  )

  const handleClaimSubmission = useCallback(async () => {
    if (!urlEditToken || !userId) return

    setClaiming(true)
    setPageError(null)
    setSaveNotice(null)
    try {
      const { data, error } = await supabase.rpc('claim_submission_for_edit', {
        p_contest_id: contest.id,
        p_edit_token: urlEditToken,
      })
      if (error) {
        setPageError(
          contestEntryLoadErrorMessage(error.message, contest.published),
        )
        return
      }
      setEditSubmissionUserId(userId)
      invalidateDraftLoad()
      const result = data as { already_claimed?: boolean } | null
      if (result?.already_claimed) {
        setSaveNotice('This submission is already linked to your account.')
      } else {
        setSaveNotice(
          'Submission linked to your account. You can keep editing here or return while signed in next time.',
        )
      }
    } finally {
      setClaiming(false)
    }
  }, [contest.id, contest.published, invalidateDraftLoad, urlEditToken, supabase, userId])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (ownerClosedOutcome === 'readonly') return
      if (contestClosed(contest.deadline) && !isAdmin) {
        setPageError('Submissions are closed.')
        return
      }
      setSubmitting(true)
      setPageError(null)
      setSaveNotice(null)
      const guessPayload = tracks.map((t) => ({
        track_id: t.id,
        text: guesses[t.id] ?? '',
      }))
      const submitEditToken = userId
        ? urlEditToken.length > 0
          ? urlEditToken
          : null
        : urlEditToken || anonymousEditToken || null
      try {
        if (useAdminApi && adminSubmissionId) {
          const { error } = await supabase.rpc(
            'admin_update_submission_guesses',
            {
              p_submission_id: adminSubmissionId,
              p_guesses: guessPayload,
            },
          )
          if (error) {
            setPageError(
              contestEntryLoadErrorMessage(error.message, contest.published),
            )
            return
          }
          setSaveNotice('Saved.')
          setHasSubmission(true)
          commitSavedSnapshot(name, guesses)
          return
        }
        const { data, error } = await supabase.rpc('submit_contest_entry', {
          p_contest_id: contest.id,
          p_contestant_name: name.trim(),
          p_guesses: guessPayload,
          p_edit_token: submitEditToken,
        })
        if (error) {
          setPageError(
            contestEntryLoadErrorMessage(error.message, contest.published),
          )
          return
        }
        const res = data as SubmitContestPayload
        const tokenFromResponse =
          typeof res.edit_token === 'string' && res.edit_token.length > 0
            ? res.edit_token
            : null
        const nextEditToken = tokenFromResponse ?? submitEditToken
        invalidateDraftLoad()
        if (nextEditToken && !userId) {
          persistEditToken(nextEditToken)
          setSaveNotice(
            submitEditToken
              ? 'Saved.'
              : 'Saved. Copy your edit link below to continue from another device.',
          )
        } else {
          if (urlEditToken && userId) {
            const params = new URLSearchParams(searchParams)
            params.delete('edit')
            const query = params.toString()
            navigate(
              query.length > 0
                ? `/contests/${slug}?${query}`
                : `/contests/${slug}`,
              {
                replace: true,
              },
            )
          }
          setSaveNotice('Saved.')
        }
        setHasSubmission(true)
        commitSavedSnapshot(name, guesses)
      } finally {
        setSubmitting(false)
      }
    },
    [
      adminSubmissionId,
      anonymousEditToken,
      contest,
      guesses,
      invalidateDraftLoad,
      isAdmin,
      name,
      navigate,
      ownerClosedOutcome,
      persistEditToken,
      searchParams,
      slug,
      supabase,
      tracks,
      urlEditToken,
      useAdminApi,
      userId,
      commitSavedSnapshot,
    ],
  )

  const closed = contestClosed(contest.deadline)
  const ownerClosedReadOnly = closed && ownerClosedOutcome === 'readonly'
  const needAdminInfo = closed || Boolean(adminSubmissionId)
  const showAdminChecking = needAdminInfo && !ready
  const showClosedToVisitor =
    closed &&
    ready &&
    !isAdmin &&
    !adminSubmissionId &&
    (!userId || ownerClosedOutcome === 'none')
  const showAdminSignIn = Boolean(adminSubmissionId) && ready && !isAdmin
  const canUseForm =
    tracks.length > 0 &&
    (!closed || isAdmin || ownerClosedReadOnly) &&
    (!adminSubmissionId || (isAdmin && !draftLoading && useAdminApi))
  const showPlaySection =
    tracks.length > 0 &&
    !showAdminSignIn &&
    !(Boolean(adminSubmissionId) && ready && !isAdmin)
  const showSubmissionFields =
    !closed || hasSubmission || (Boolean(adminSubmissionId) && useAdminApi)
  const showAdminDraftError =
    Boolean(adminSubmissionId) &&
    isAdmin &&
    ready &&
    !draftLoading &&
    pageError &&
    !useAdminApi
  const sessionLocksName =
    Boolean(userId) && !adminSubmissionId && !useAdminApi && !urlEditToken
  const nameInputDisabled =
    draftLoading || nameReadOnly || sessionLocksName || ownerClosedReadOnly
  const missingDisplayNameWhileSignedIn =
    Boolean(userId) &&
    ready &&
    !profileDisplayNameForSubmit &&
    !urlEditToken &&
    !adminSubmissionId
  const showClaimSubmission =
    Boolean(userId) &&
    ready &&
    Boolean(urlEditToken) &&
    !adminSubmissionId &&
    !draftLoading &&
    editSubmissionUserId === null &&
    canUseForm &&
    !ownerClosedReadOnly
  const editToken = urlEditToken || anonymousEditToken
  const editUrl = useMemo(() => {
    if (!editToken) return ''
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    return `${origin}/contests/${encodeURIComponent(slug)}?edit=${encodeURIComponent(editToken)}`
  }, [editToken, slug])
  const canCopyEditLink =
    Boolean(editToken) && !adminSubmissionId && !useAdminApi
  const currentSnapshot = useMemo(
    () =>
      savedSnapshot === null ? null : entrySnapshot(name, guesses, tracks),
    [savedSnapshot, name, guesses, tracks],
  )
  const isDirty =
    !draftLoading &&
    savedSnapshot !== null &&
    currentSnapshot !== savedSnapshot &&
    showSubmissionFields &&
    !ownerClosedReadOnly &&
    !adminSubmissionId
  const shouldBlockNavigation = isDirty && canUseForm && !submitting
  const blocker = useBlocker(shouldBlockNavigation)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const leave = window.confirm(
      'You have unsaved changes. Leave this page anyway?',
    )
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!shouldBlockNavigation) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [shouldBlockNavigation])

  return {
    name,
    setName,
    guesses,
    setGuesses,
    pageError,
    saveNotice,
    submitting,
    draftLoading,
    claiming,
    editToken: urlEditToken || anonymousEditToken,
    editUrl,
    canCopyEditLink,
    isDirty,
    urlEditToken,
    adminSubmissionId,
    useAdminApi,
    ownerClosedReadOnly,
    showAdminChecking,
    showClosedToVisitor,
    showAdminSignIn,
    canUseForm,
    showPlaySection,
    showSubmissionFields,
    hasSubmission,
    showAdminDraftError,
    nameInputDisabled,
    missingDisplayNameWhileSignedIn,
    showClaimSubmission,
    sessionLocksName,
    closed,
    isAdmin,
    ready,
    handleClaimSubmission,
    handleSubmit,
  }
}
