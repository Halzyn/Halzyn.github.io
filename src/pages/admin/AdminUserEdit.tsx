import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getSupabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { useAuth } from '../../auth/AuthContext'
import { useAdminUserProfile } from '../../hooks/useAdminQueries'
import { LoadingState } from '../../components/LoadingState'
import { useToast } from '../../toast/ToastContext'

const SUBMISSION_UUID_RE = /^[0-9a-f-]{36}$/i

export function AdminUserEdit() {
  const supabase = getSupabase()
  const { id: userId } = useParams()
  const navigate = useNavigate()
  const { session, ready: sessionReady } = useAuth()
  const { data: loadedProfile, error: queryError } = useAdminUserProfile(userId)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [submissionIdInput, setSubmissionIdInput] = useState('')
  const { success: toastSuccess } = useToast()
  const [pageError, setPageError] = useState<string | null>(null)

  const clearFeedback = useCallback(() => {
    setPageError(null)
  }, [])

  const documentTitle = useMemo(
    () =>
      profile
        ? pageTitle('Admin', 'User', profile.username ?? userId ?? '')
        : pageTitle('Admin', 'User'),
    [profile, userId],
  )

  useDocumentTitle(documentTitle)

  useEffect(() => {
    if (!loadedProfile) return
    setProfile(loadedProfile)
    setUsername(loadedProfile.username ?? '')
    setDisplayName(loadedProfile.display_name ?? '')
    setBio(loadedProfile.bio ?? '')
  }, [loadedProfile])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    clearFeedback()
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq('id', profile.id)
    if (error) {
      setPageError(error.message)
      return
    }
    toastSuccess('Saved.')
  }

  async function assignSubmission(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    clearFeedback()
    const submissionUuid = submissionIdInput.trim()
    if (!SUBMISSION_UUID_RE.test(submissionUuid)) {
      setPageError('Enter a valid submission UUID.')
      return
    }
    const { error } = await supabase.rpc('admin_assign_submission_owner', {
      p_submission_id: submissionUuid,
      p_user_id: profile.id,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    toastSuccess('Submission assigned.')
    setSubmissionIdInput('')
  }

  const isEditingOwnProfile =
    sessionReady && session !== null && session.user.id === profile?.id

  const loadError = queryError instanceof Error ? queryError.message : null

  async function deleteUser() {
    if (!profile || isEditingOwnProfile) return
    const confirmLabel = displayName.trim() || username.trim() || profile.id
    if (
      !window.confirm(
        `Permanently delete account "${confirmLabel}"? Their auth login, profile, and moderator assignments will be removed. Submissions stay but unlink from this user. This cannot be undone.`,
      )
    ) {
      return
    }
    clearFeedback()
    const { error } = await supabase.rpc('admin_delete_auth_user', {
      p_target_user_id: profile.id,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    navigate('/admin/users')
  }

  if (!userId) return null
  if ((pageError || loadError) && !profile) {
    return <p className="banner warn">{pageError ?? loadError}</p>
  }
  if (!profile) return <LoadingState label="Loading user..." size="page" />

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/users">← Users</Link>
      </p>
      <h1>Edit user</h1>
      <p className="muted small">
        Player #{profile.player_number ?? '-'} id <code>{profile.id}</code>
      </p>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

      <section className="section">
        <h2>Profile</h2>
        <form className="form" onSubmit={saveProfile}>
          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="field">
            <span>Bio</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={3} />
          </label>
          <button type="submit" className="button primary">
            Save
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Assign submission</h2>
        <p className="muted small">
          Paste a submission UUID to attach this contest entry to the user.
        </p>
        <form className="form" onSubmit={assignSubmission}>
          <label className="field">
            <span>Submission id</span>
            <input
              value={submissionIdInput}
              onChange={(event) => setSubmissionIdInput(event.target.value)}
              placeholder="uuid"
            />
          </label>
          <button type="submit" className="button">
            Assign owner
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Danger zone OH NOES!!!!!</h2>
        <p className="muted small">
          Deletes the Supabase auth account and profile. Contest submissions remain with no linked player.
        </p>
        {!sessionReady ? (
          <LoadingState label="Loading..." size="inline" />
        ) : isEditingOwnProfile ? (
          <p className="muted small">What are you doing you dumbass</p>
        ) : (
          <button type="button" className="button danger" onClick={() => void deleteUser()}>
            Delete user
          </button>
        )}
      </section>
    </div>
  )
}
