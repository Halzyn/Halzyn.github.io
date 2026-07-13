import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { contestClosed } from '../lib/deadline'
import {
  type AdminDraftPayload,
  type EditDraftPayload,
  type SubmitContestPayload,
  contestantNameFromDraft,
  guessMapFromDraft,
  mergeDraftIntoGuessesState,
  submissionIdFromSearchParam,
  contestEntryLoadErrorMessage,
} from '../lib/contestEntry'
import {
  clearStoredContestEntry,
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

function emptyGuessesForTracks(trackList: Track[]): Record<string, string> {
  const empty: Record<string, string> = {}
  for (const track of trackList) empty[track.id] = ''
  return empty
}

function parseEditDraftPayload(data: unknown): EditDraftPayload | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as EditDraftPayload
    } catch {
      return null
    }
  }
  return data as EditDraftPayload
}

function applyDraftToState(
  row: EditDraftPayload,
  trackList: Track[],
): { name: string; guesses: Record<string, string> } {
  const draftByTrack = guessMapFromDraft(row)
  return {
    name: contestantNameFromDraft(row),
    guesses: mergeDraftIntoGuessesState(
      draftByTrack,
      trackList,
      emptyGuessesForTracks(trackList),
    ),
  }
}

function entrySnapshot(
  entryName: string,
  entryGuesses: Record<string, string>,
  trackList: Track[],
): string {
  const normalizedGuesses: Record<string, string> = {}
  for (const track of trackList)
    normalizedGuesses[track.id] = (entryGuesses[track.id] ?? '').trim()
  return JSON.stringify({ name: entryName.trim(), guesses: normalizedGuesses })
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
  const loadedDraftKeyRef = useRef<string | null>(null)
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
    loadedDraftKeyRef.current = null
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
  }, [contest.id, trackIdsKey])

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

    async function loadDraft() {
      setDraftLoading(true)
      setPageError(null)

      const closed = contestClosed(contest.deadline)

      try {
        if (adminSubmissionId) {
          if (!ready) return

          if (!isAdmin) {
            setNameReadOnly(false)
            setUseAdminApi(false)
            return
          }

          const { data, error } = await supabase.rpc(
            'admin_get_submission_draft',
            {
              p_submission_id: adminSubmissionId,
            },
          )

          if (cancelled) return

          if (error) {
            setNameReadOnly(false)
            setUseAdminApi(false)
            setPageError(
              contestEntryLoadErrorMessage(error.message, contest.published),
            )
            return
          }

          const row = data as AdminDraftPayload
          if (row.contest_id !== contest.id) {
            setNameReadOnly(false)
            setUseAdminApi(false)
            setPageError('This submission is not for this contest.')
            return
          }

          const applied = applyDraftToState(row, tracks)
          setUseAdminApi(true)
          setNameReadOnly(true)
          setName(applied.name)
          setGuesses(applied.guesses)
          setHasSubmission(true)
          commitSavedSnapshot(applied.name, applied.guesses)
          loadedDraftKeyRef.current = loadKey
          return
        }

        const editTokenToLoad = urlEditToken || anonymousEditToken
        if (editTokenToLoad) {
          if (closed && !ready) return
          if (closed && !isAdmin && !editTokenToLoad) return

          const { data, error } = await supabase.rpc(
            'get_submission_for_edit',
            {
              p_contest_id: contest.id,
              p_edit_token: editTokenToLoad,
            },
          )

          if (cancelled) return
          if (error) {
            setNameReadOnly(false)
            setPageError(
              contestEntryLoadErrorMessage(error.message, contest.published),
            )
            if (!urlEditToken && anonymousEditToken)
              clearStoredContestEntry(slug)
            return
          }

          const row = parseEditDraftPayload(data)
          if (!row) {
            setHasSubmission(false)
            commitSavedSnapshot('', emptyGuessesForTracks(tracks))
            loadedDraftKeyRef.current = loadKey
            return
          }

          const applied = applyDraftToState(row, tracks)
          setNameReadOnly(true)
          setName(applied.name)
          setEditSubmissionUserId(row.user_id ?? null)
          setGuesses(applied.guesses)
          setHasSubmission(true)
          if (closed && !isAdmin) setOwnerClosedOutcome('readonly')
          else setOwnerClosedOutcome('unset')
          if (!userId) setStoredContestEntry(slug, editTokenToLoad)
          commitSavedSnapshot(applied.name, applied.guesses)
          loadedDraftKeyRef.current = loadKey
          return
        }

        if (!sessionUserId) {
          setNameReadOnly(false)
          if (closed && !isAdmin) setOwnerClosedOutcome('unset')
          commitSavedSnapshot('', emptyGuessesForTracks(tracks))
          loadedDraftKeyRef.current = loadKey
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()

        if (cancelled) return
        if (!sessionData.session?.user) return
        const { data, error } = await supabase.rpc('get_submission_for_owner', {
          p_contest_id: contest.id,
        })

        if (cancelled) return

        if (error) {
          setPageError(
            contestEntryLoadErrorMessage(error.message, contest.published),
          )
          return
        }

        const row = parseEditDraftPayload(data)
        if (!row) {
          setHasSubmission(false)
          if (closed && !isAdmin) setOwnerClosedOutcome('none')
          else setOwnerClosedOutcome('unset')
          commitSavedSnapshot(
            profileDisplayNameForSubmit ?? '',
            emptyGuessesForTracks(tracks),
          )
          loadedDraftKeyRef.current = loadKey
          return
        }

        const applied = applyDraftToState(row, tracks)
        setHasSubmission(true)
        setNameReadOnly(true)
        setName(applied.name)
        setGuesses(applied.guesses)
        if (closed && !isAdmin) setOwnerClosedOutcome('readonly')
        else setOwnerClosedOutcome('unset')
        commitSavedSnapshot(applied.name, applied.guesses)
        loadedDraftKeyRef.current = loadKey
      } finally {
        if (!cancelled) setDraftLoading(false)
      }
    }

    void loadDraft()
    return () => {
      cancelled = true
    }
  }, [
    adminSubmissionId,
    anonymousEditToken,
    contest.id,
    contest.deadline,
    isAdmin,
    ready,
    sessionUserId,
    slug,
    supabase,
    trackIdsKey,
    tracks,
    urlEditToken,
    userId,
    profileDisplayNameForSubmit,
    commitSavedSnapshot,
  ])

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
      loadedDraftKeyRef.current = null
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
  }, [contest.id, urlEditToken, supabase, userId])

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
        loadedDraftKeyRef.current = null
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
