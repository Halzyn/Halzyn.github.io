import { contestClosed } from './deadline'
import {
  type AdminDraftPayload,
  applyDraftToState,
  contestEntryLoadErrorMessage,
  emptyGuessesForTracks,
  parseEditDraftPayload,
} from './contestEntry'
import { clearStoredContestEntry, setStoredContestEntry } from './contestEntryStorage'
import type { getSupabase } from './supabase'
import type { Contest, Track } from './types'

type SupabaseClient = ReturnType<typeof getSupabase>

export type DraftLoadPatch = {
  pageError?: string | null
  nameReadOnly?: boolean
  useAdminApi?: boolean
  name?: string
  guesses?: Record<string, string>
  hasSubmission?: boolean
  editSubmissionUserId?: string | null
  ownerClosedOutcome?: 'unset' | 'none' | 'readonly'
  clearStored?: boolean
  storeEditToken?: string
  snapshot?: { name: string; guesses: Record<string, string> }
}

export type DraftLoadResult =
  | { kind: 'abort' }
  | { kind: 'done'; loadKey: string; patch: DraftLoadPatch }

export type LoadContestDraftParams = {
  supabase: SupabaseClient
  contest: Contest
  tracks: Track[]
  slug: string
  loadKey: string
  adminSubmissionId: string
  urlEditToken: string
  anonymousEditToken: string
  sessionUserId: string | null
  userId: string | null
  isAdmin: boolean
  ready: boolean
  profileDisplayNameForSubmit: string | null
}

export async function loadContestDraft(
  params: LoadContestDraftParams,
): Promise<DraftLoadResult> {
  const {
    supabase,
    contest,
    tracks,
    loadKey,
    adminSubmissionId,
    urlEditToken,
    anonymousEditToken,
    sessionUserId,
    userId,
    isAdmin,
    ready,
    profileDisplayNameForSubmit,
  } = params

  const closed = contestClosed(contest.deadline)

  if (adminSubmissionId) {
    if (!ready) return { kind: 'abort' }
    if (!isAdmin) {
      return {
        kind: 'done',
        loadKey,
        patch: { nameReadOnly: false, useAdminApi: false },
      }
    }

    const { data, error } = await supabase.rpc('admin_get_submission_draft', {
      p_submission_id: adminSubmissionId,
    })

    if (error) {
      return {
        kind: 'done',
        loadKey,
        patch: {
          nameReadOnly: false,
          useAdminApi: false,
          pageError: contestEntryLoadErrorMessage(error.message, contest.published),
        },
      }
    }

    const row = data as AdminDraftPayload
    if (row.contest_id !== contest.id) {
      return {
        kind: 'done',
        loadKey,
        patch: {
          nameReadOnly: false,
          useAdminApi: false,
          pageError: 'This submission is not for this contest.',
        },
      }
    }

    const applied = applyDraftToState(row, tracks)
    return {
      kind: 'done',
      loadKey,
      patch: {
        useAdminApi: true,
        nameReadOnly: true,
        name: applied.name,
        guesses: applied.guesses,
        hasSubmission: true,
        snapshot: applied,
      },
    }
  }

  const editTokenToLoad = urlEditToken || anonymousEditToken
  if (editTokenToLoad) {
    if (closed && !ready) return { kind: 'abort' }
    if (closed && !isAdmin && !editTokenToLoad) return { kind: 'abort' }

    const { data, error } = await supabase.rpc('get_submission_for_edit', {
      p_contest_id: contest.id,
      p_edit_token: editTokenToLoad,
    })

    if (error) {
      return {
        kind: 'done',
        loadKey,
        patch: {
          nameReadOnly: false,
          pageError: contestEntryLoadErrorMessage(error.message, contest.published),
          clearStored: !urlEditToken && Boolean(anonymousEditToken),
        },
      }
    }

    const row = parseEditDraftPayload(data)
    if (!row) {
      return {
        kind: 'done',
        loadKey,
        patch: {
          hasSubmission: false,
          snapshot: { name: '', guesses: emptyGuessesForTracks(tracks) },
        },
      }
    }

    const applied = applyDraftToState(row, tracks)
    return {
      kind: 'done',
      loadKey,
      patch: {
        nameReadOnly: true,
        name: applied.name,
        editSubmissionUserId: row.user_id ?? null,
        guesses: applied.guesses,
        hasSubmission: true,
        ownerClosedOutcome: closed && !isAdmin ? 'readonly' : 'unset',
        storeEditToken: !userId ? editTokenToLoad : undefined,
        snapshot: applied,
      },
    }
  }

  if (!sessionUserId) {
    return {
      kind: 'done',
      loadKey,
      patch: {
        nameReadOnly: false,
        ownerClosedOutcome: closed && !isAdmin ? 'unset' : undefined,
        snapshot: { name: '', guesses: emptyGuessesForTracks(tracks) },
      },
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return { kind: 'abort' }

  const { data, error } = await supabase.rpc('get_submission_for_owner', {
    p_contest_id: contest.id,
  })

  if (error) {
    return {
      kind: 'done',
      loadKey,
      patch: {
        pageError: contestEntryLoadErrorMessage(error.message, contest.published),
      },
    }
  }

  const row = parseEditDraftPayload(data)
  if (!row) {
    return {
      kind: 'done',
      loadKey,
      patch: {
        hasSubmission: false,
        ownerClosedOutcome: closed && !isAdmin ? 'none' : 'unset',
        snapshot: {
          name: profileDisplayNameForSubmit ?? '',
          guesses: emptyGuessesForTracks(tracks),
        },
      },
    }
  }

  const applied = applyDraftToState(row, tracks)
  return {
    kind: 'done',
    loadKey,
    patch: {
      hasSubmission: true,
      nameReadOnly: true,
      name: applied.name,
      guesses: applied.guesses,
      ownerClosedOutcome: closed && !isAdmin ? 'readonly' : 'unset',
      snapshot: applied,
    },
  }
}

export function applyDraftLoadPatch(
  patch: DraftLoadPatch,
  slug: string,
  handlers: {
    setPageError: (value: string | null) => void
    setNameReadOnly: (value: boolean) => void
    setUseAdminApi: (value: boolean) => void
    setName: (value: string) => void
    setGuesses: (value: Record<string, string>) => void
    setHasSubmission: (value: boolean) => void
    setEditSubmissionUserId: (value: string | null) => void
    setOwnerClosedOutcome: (value: 'unset' | 'none' | 'readonly') => void
    commitSavedSnapshot: (name: string, guesses: Record<string, string>) => void
  },
): void {
  if (patch.pageError !== undefined) handlers.setPageError(patch.pageError)
  if (patch.nameReadOnly !== undefined) handlers.setNameReadOnly(patch.nameReadOnly)
  if (patch.useAdminApi !== undefined) handlers.setUseAdminApi(patch.useAdminApi)
  if (patch.name !== undefined) handlers.setName(patch.name)
  if (patch.guesses !== undefined) handlers.setGuesses(patch.guesses)
  if (patch.hasSubmission !== undefined) handlers.setHasSubmission(patch.hasSubmission)
  if (patch.editSubmissionUserId !== undefined)
    handlers.setEditSubmissionUserId(patch.editSubmissionUserId)
  if (patch.ownerClosedOutcome !== undefined)
    handlers.setOwnerClosedOutcome(patch.ownerClosedOutcome)
  if (patch.clearStored) clearStoredContestEntry(slug)
  if (patch.storeEditToken) setStoredContestEntry(slug, patch.storeEditToken)
  if (patch.snapshot) handlers.commitSavedSnapshot(patch.snapshot.name, patch.snapshot.guesses)
}
