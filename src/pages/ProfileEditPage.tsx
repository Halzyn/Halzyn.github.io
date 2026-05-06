import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { avatarPublicUrl, resizeImageFileToAvatarJpeg } from '../lib/avatar'
import { compareGameTitles } from '../lib/gamesIndex'
import type { Game, Profile } from '../lib/types'
import { contestClosed } from '../lib/deadline'

type EditTab = 'basic' | 'private' | 'submissions' | 'fun' | 'moderation'

type MyContestSubmissionRow = {
  submission_id: string
  contest_id: string
  contest_slug: string
  contest_title: string
  deadline: string
  results_published: boolean
}

type ModeratedContest = { id: string; slug: string; title: string }

const USERNAME_REGEX = /^[a-z0-9_]{2,32}$/

const PROFILE_SECTION_TABS: { tab: EditTab; label: string }[] = [
  { tab: 'basic', label: 'Basic info' },
  { tab: 'private', label: 'Private info' },
  { tab: 'submissions', label: 'Submissions' },
  { tab: 'fun', label: 'Fun' },
]

function tabButtonClass(selected: boolean): string {
  return selected ? 'button small primary' : 'button small ghost'
}

function collectModeratedContestsFromRows(
  rows: { contests: ModeratedContest | ModeratedContest[] | null }[],
): ModeratedContest[] {
  const list: ModeratedContest[] = []
  const seenIds = new Set<string>()
  for (const row of rows) {
    const embedded = row.contests
    if (!embedded) continue
    for (const contest of Array.isArray(embedded) ? embedded : [embedded]) {
      if (contest?.id && !seenIds.has(contest.id)) {
        seenIds.add(contest.id)
        list.push(contest)
      }
    }
  }
  list.sort((a, b) => a.title.localeCompare(b.title))
  return list
}

export function ProfileEditPage() {
  useDocumentTitle(pageTitle('Your profile'))
  const supabase = getSupabase()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pageError, setPageError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [noSession, setNoSession] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [gamesLoadError, setGamesLoadError] = useState<string | null>(null)
  const [gameSearch, setGameSearch] = useState('')
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [editTab, setEditTab] = useState<EditTab>('basic')
  const [moderatedContests, setModeratedContests] = useState<ModeratedContest[]>([])
  const [moderatedContestsLoaded, setModeratedContestsLoaded] = useState(false)
  const [notifyNewContestEmail, setNotifyNewContestEmail] = useState(false)
  const [notifyEmailBusy, setNotifyEmailBusy] = useState(false)
  const [mySubmissions, setMySubmissions] = useState<MyContestSubmissionRow[] | null>(null)
  const [submissionsLoadError, setSubmissionsLoadError] = useState<string | null>(null)

  const clearFeedback = useCallback(() => {
    setPageError(null)
    setSuccessMessage(null)
  }, [])

  useEffect(() => {
    async function loadSessionAndProfile() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user) {
        setNoSession(true)
        setSessionReady(true)
        return
      }
      setEmail(sessionData.session.user.email ?? '')
      const { data: profileRow, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single()
      if (error) {
        setPageError(error.message)
        setSessionReady(true)
        return
      }
      const loaded = profileRow as Profile
      setProfile(loaded)
      setUsername(loaded.username ?? '')
      setDisplayName(loaded.display_name ?? '')
      setBio(loaded.bio ?? '')
      setFavoriteGameId(loaded.favorite_soundtrack_game_id ?? null)
      setNotifyNewContestEmail(Boolean(loaded.notify_new_contest_email))
      setSessionReady(true)
    }
    void loadSessionAndProfile()
  }, [supabase])

  useEffect(() => {
    if (!profile) return
    const profileUserId = profile.id
    if (profile.is_admin) {
      setModeratedContests([])
      setModeratedContestsLoaded(true)
      return
    }
    setModeratedContestsLoaded(false)

    async function loadModeratedContests() {
      const { data, error } = await supabase
        .from('contest_moderators')
        .select('contest_id, contests ( id, slug, title )')
        .eq('user_id', profileUserId)
      setModeratedContestsLoaded(true)
      if (error || !data) {
        setModeratedContests([])
        return
      }
      const rows = data as { contests: ModeratedContest | ModeratedContest[] | null }[]
      setModeratedContests(collectModeratedContestsFromRows(rows))
    }

    void loadModeratedContests()
  }, [profile?.id, profile?.is_admin, supabase])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setMySubmissions(null)
    setSubmissionsLoadError(null)

    async function loadMySubmissions() {
      const { data, error } = await supabase.rpc('list_my_contest_submissions')
      if (cancelled) return
      if (error) {
        setSubmissionsLoadError(error.message)
        setMySubmissions([])
        return
      }
      const list = Array.isArray(data) ? (data as MyContestSubmissionRow[]) : []
      setMySubmissions(list)
    }

    void loadMySubmissions()
    return () => {
      cancelled = true
    }
  }, [profile?.id, supabase])

  const showModerationTab = Boolean(
    profile && (profile.is_admin || (moderatedContestsLoaded && moderatedContests.length > 0)),
  )

  useEffect(() => {
    if (!showModerationTab && editTab === 'moderation') {
      setEditTab('basic')
    }
  }, [showModerationTab, editTab])

  const avatarPreview = useMemo(
    () => (profile ? avatarPublicUrl(supabase, profile.avatar_path) : null),
    [profile, supabase],
  )

  useEffect(() => {
    if (!profile) return

    async function loadFavoritePickGames() {
      setGamesLoadError(null)
      setGamesLoading(true)
      const { data, error } = await supabase.rpc('list_games_for_favorite_soundtrack')
      setGamesLoading(false)
      if (error) {
        setGamesLoadError(error.message)
        setGames([])
        return
      }
      setGames(
        ((data ?? []) as Game[]).slice().sort((a, b) => compareGameTitles(a.primary_title, b.primary_title)),
      )
    }

    void loadFavoritePickGames()
  }, [profile?.id, supabase])

  const filteredGames = useMemo(() => {
    const query = gameSearch.trim().toLowerCase()
    const list = !query ? games : games.filter((game) => game.primary_title.toLowerCase().includes(query))
    return list.slice(0, 100)
  }, [games, gameSearch])

  const selectedGame = useMemo(
    () => (favoriteGameId ? games.find((game) => game.id === favoriteGameId) : null),
    [games, favoriteGameId],
  )

  const { openSubmissions, closedSubmissions } = useMemo(() => {
    if (!mySubmissions) {
      return { openSubmissions: [] as MyContestSubmissionRow[], closedSubmissions: [] as MyContestSubmissionRow[] }
    }
    const open = mySubmissions.filter((row) => !contestClosed(row.deadline))
    const closed = mySubmissions.filter((row) => contestClosed(row.deadline))
    return { openSubmissions: open, closedSubmissions: closed }
  }, [mySubmissions])

  const saveFavorite = useCallback(async () => {
    if (!profile) return
    clearFeedback()
    setFavoriteBusy(true)
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ favorite_soundtrack_game_id: favoriteGameId })
      .eq('id', profile.id)
      .select('*')
      .single()
    setFavoriteBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setProfile(updated as Profile)
    setSuccessMessage('Favorite soundtrack saved.')
  }, [clearFeedback, favoriteGameId, profile, supabase])

  async function savePublic(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    clearFeedback()
    const normalizedUsername = username.trim().toLowerCase()
    if (normalizedUsername && !USERNAME_REGEX.test(normalizedUsername)) {
      setPageError('Username: 2-32 characters, lowercase letters, digits, or underscore.')
      return
    }
    setSubmitBusy(true)
    const previousUsername = (profile.username ?? '').toLowerCase()
    if (normalizedUsername !== previousUsername) {
      const { data: usernameAvailable } = await supabase.rpc('username_is_available', {
        p_username: normalizedUsername,
      })
      if (usernameAvailable === false) {
        setSubmitBusy(false)
        setPageError('That username is taken.')
        return
      }
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        username: normalizedUsername || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      })
      .eq('id', profile.id)
    setSubmitBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setSuccessMessage('Profile saved.')
  }

  async function saveNotifyNewContestEmail(enabled: boolean) {
    if (!profile) return
    clearFeedback()
    setNotifyEmailBusy(true)
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ notify_new_contest_email: enabled })
      .eq('id', profile.id)
      .select('*')
      .single()
    setNotifyEmailBusy(false)
    if (error) {
      setPageError(error.message)
      setNotifyNewContestEmail(Boolean(profile.notify_new_contest_email))
      return
    }
    setProfile(updated as Profile)
    setNotifyNewContestEmail(enabled)
    setSuccessMessage(
      enabled
        ? 'You will get an email when a new contest is published.'
        : 'Contest announcement emails turned off.',
    )
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    setSubmitBusy(true)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setSubmitBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setSuccessMessage('Check your inbox to confirm the new email if required.')
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    if (newPassword.length < 8) {
      setPageError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== passwordConfirm) {
      setPageError('Passwords do not match.')
      return
    }
    setSubmitBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setNewPassword('')
    setPasswordConfirm('')
    setSuccessMessage('Password updated.')
  }

  async function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!profile || !file) return
    clearFeedback()
    setAvatarBusy(true)
    const newPath = `${profile.id}/${crypto.randomUUID()}.jpg`
    const previousPath = profile.avatar_path ?? null
    try {
      const blob = await resizeImageFileToAvatarJpeg(file)
      const { error: uploadError } = await supabase.storage.from('avatars').upload(newPath, blob, {
        cacheControl: '31536000',
        upsert: false,
        contentType: 'image/jpeg',
      })
      if (uploadError) {
        setPageError(uploadError.message)
        return
      }
      const { data: updated, error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_path: newPath })
        .eq('id', profile.id)
        .select('*')
        .single()
      if (profileError) {
        setPageError(profileError.message)
        await supabase.storage.from('avatars').remove([newPath])
        return
      }
      setProfile(updated as Profile)
      setSuccessMessage('Profile picture updated.')
      if (previousPath && previousPath !== newPath) {
        await supabase.storage.from('avatars').remove([previousPath])
      }
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Could not process image.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function removeAvatar() {
    if (!profile?.avatar_path) return
    clearFeedback()
    setAvatarBusy(true)
    const { error: removeStorageError } = await supabase.storage.from('avatars').remove([profile.avatar_path])
    if (removeStorageError) {
      setPageError(removeStorageError.message)
      setAvatarBusy(false)
      return
    }
    const { data: updated, error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', profile.id)
      .select('*')
      .single()
    setAvatarBusy(false)
    if (profileError) {
      setPageError(profileError.message)
      return
    }
    setProfile(updated as Profile)
    setSuccessMessage('Profile picture removed.')
  }

  if (!sessionReady) {
    return <p className="muted">Loading...</p>
  }
  if (noSession) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div className="page">
      <div className="profile-page-top">
        <p className="muted small profile-page-top-back">
          <Link
            to={
              profile?.username ? `/players/${encodeURIComponent(profile.username)}` : '/players'
            }
          >
            ← {profile?.username ? 'Public profile' : 'Players'}
          </Link>
        </p>
        <Link to="/" className="muted small profile-page-edit-link">
          Home
        </Link>
      </div>

      <header className="page-head">
        <h1>Your profile</h1>
      </header>
      {pageError ? <p className="banner warn">{pageError}</p> : null}
      {successMessage ? <p className="banner">{successMessage}</p> : null}

      <div className="row tight site-toolbar profile-edit-tabs" role="tablist" aria-label="Profile sections">
        {PROFILE_SECTION_TABS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`profile-tab-${tab}`}
            aria-selected={editTab === tab}
            aria-controls={`profile-panel-${tab}`}
            className={tabButtonClass(editTab === tab)}
            onClick={() => setEditTab(tab)}
          >
            {label}
          </button>
        ))}
        {showModerationTab ? (
          <button
            type="button"
            role="tab"
            id="profile-tab-moderation"
            aria-selected={editTab === 'moderation'}
            aria-controls="profile-panel-moderation"
            className={tabButtonClass(editTab === 'moderation')}
            onClick={() => setEditTab('moderation')}
          >
            Moderation
          </button>
        ) : null}
      </div>

      <div
        id="profile-panel-basic"
        role="tabpanel"
        aria-labelledby="profile-tab-basic"
        hidden={editTab !== 'basic'}
        className="profile-edit-tab-panel"
      >
        <section className="section">
          <h2>Profile picture</h2>
          <p className="muted small">Uploaded files will be resized to 150x150 pixels.</p>
          <div className="profile-edit-avatar-row">
            {avatarPreview ? (
              <img
                key={profile?.avatar_path ?? 'avatar'}
                src={avatarPreview}
                alt=""
                className="profile-avatar-large"
                width={150}
                height={150}
                decoding="async"
              />
            ) : (
              <span className="profile-avatar-large profile-avatar-large--empty" aria-hidden />
            )}
            <div className="profile-edit-avatar-actions">
              <label className="button small primary" style={{ cursor: avatarBusy ? 'wait' : 'pointer' }}>
                {avatarBusy ? 'Working...' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  disabled={avatarBusy || !profile}
                  onChange={onAvatarFile}
                />
              </label>
              {profile?.avatar_path ? (
                <button type="button" className="button small ghost" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Public profile</h2>
          <form className="form" onSubmit={savePublic}>
            <label className="field">
              <span>Username (URL: /players/username)</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>

            <label className="field">
              <span>Display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>

            <label className="field">
              <span>Bio</span>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
            </label>

            <button type="submit" className="button primary" disabled={submitBusy}>
              Save profile
            </button>
          </form>
          {profile?.username ? (
            <p>
              <Link to={`/players/${encodeURIComponent(profile.username)}`}>View public profile</Link>
            </p>
          ) : null}
        </section>
      </div>

      <div
        id="profile-panel-private"
        role="tabpanel"
        aria-labelledby="profile-tab-private"
        hidden={editTab !== 'private'}
        className="profile-edit-tab-panel"
      >
        <section className="section">
          <h2>Email</h2>
          <form className="form" onSubmit={saveEmail}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <button type="submit" className="button primary" disabled={submitBusy}>
              Update email
            </button>
          </form>

          <p className="profile-subhead">Email notifications</p>
          <label className="field row">
            <input
              type="checkbox"
              checked={notifyNewContestEmail}
              disabled={notifyEmailBusy || !profile}
              onChange={(event) => void saveNotifyNewContestEmail(event.target.checked)}
            />
            <span>Email me when a new contest goes live</span>
          </label>
        </section>

        <section className="section">
          <h2>Password</h2>
          <form className="form" onSubmit={savePassword}>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Confirm</span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="button primary" disabled={submitBusy}>
              Change password
            </button>
          </form>
        </section>
      </div>

      <div
        id="profile-panel-submissions"
        role="tabpanel"
        aria-labelledby="profile-tab-submissions"
        hidden={editTab !== 'submissions'}
        className="profile-edit-tab-panel"
      >
        <section className="section">
          <h2>Contest submissions</h2>
          <p className="muted small">
            Entries linked to your account.
          </p>
          {submissionsLoadError ? <p className="banner warn">{submissionsLoadError}</p> : null}
          {mySubmissions === null ? (
            <p className="muted">Loading...</p>
          ) : mySubmissions.length === 0 ? (
            <p className="muted small">No submissions yet. If you've participated in past contests before signing up, DM me on Discord @halzyn.</p>
          ) : (
            <>
              <h3 className="profile-subhead">Open</h3>
              {openSubmissions.length > 0 ? (
                <ul className="profile-moderation-links">
                  {openSubmissions.map((submission) => (
                    <li key={submission.submission_id}>
                      <Link to={`/contests/${encodeURIComponent(submission.contest_slug)}/submit`}>
                        {submission.contest_title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">None</p>
              )}
              <h3 className="profile-subhead">Closed</h3>
              {closedSubmissions.length > 0 ? (
                <ul className="profile-moderation-links">
                  {closedSubmissions.map((submission) => (
                    <li key={submission.submission_id}>
                      <Link to={`/contests/${encodeURIComponent(submission.contest_slug)}/submit`}>
                        {submission.contest_title}
                      </Link>
                      <span className="muted small"> · View only</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">None</p>
              )}
            </>
          )}
        </section>
      </div>

      <div
        id="profile-panel-fun"
        role="tabpanel"
        aria-labelledby="profile-tab-fun"
        hidden={editTab !== 'fun'}
        className="profile-edit-tab-panel"
      >
        <section className="section">
          <h2>Favorite soundtrack</h2>
          <p className="muted small">
            This will appear on your profile page.
          </p>
          {gamesLoadError ? <p className="banner warn">{gamesLoadError}</p> : null}
          {gamesLoading ? (
            <p className="muted">Loading games...</p>
          ) : (
            <>
              <label className="field">
                <span>Search games</span>
                <input
                  value={gameSearch}
                  onChange={(event) => setGameSearch(event.target.value)}
                  placeholder="Type to filter..."
                  autoComplete="off"
                />
              </label>
              {favoriteGameId && !selectedGame ? (
                <p className="muted small">
                  Something went wrong with your saved game. Pick another one, I guess.
                </p>
              ) : selectedGame ? (
                <div className="profile-edit-favorite-picked">
                  {selectedGame.cover_image_url ? (
                    <img
                      src={selectedGame.cover_image_url}
                      alt=""
                      className="profile-edit-favorite-thumb"
                      width={64}
                      height={64}
                      decoding="async"
                    />
                  ) : (
                    <span className="profile-edit-favorite-thumb profile-edit-favorite-thumb--empty" aria-hidden />
                  )}
                  <span className="profile-edit-favorite-title">{selectedGame.primary_title}</span>
                </div>
              ) : (
                <p className="muted small">No game selected.</p>
              )}
              <ul className="profile-edit-game-list" aria-label="Choose a game">
                {filteredGames.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      className={
                        'profile-edit-game-option' +
                        (favoriteGameId === game.id ? ' profile-edit-game-option--selected' : '')
                      }
                      onClick={() => setFavoriteGameId(game.id)}
                    >
                      {game.primary_title}
                    </button>
                  </li>
                ))}
              </ul>
              {filteredGames.length === 0 && games.length > 0 ? (
                <p className="muted small">No games match your search.</p>
              ) : null}
              {games.length === 0 && !gamesLoadError ? (
                <p className="muted small">Loading games...</p>
              ) : null}
              <div className="row tight" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="button primary"
                  disabled={favoriteBusy || !profile}
                  onClick={() => void saveFavorite()}
                >
                  Save favorite
                </button>
                <button
                  type="button"
                  className="button ghost"
                  disabled={favoriteBusy}
                  onClick={() => setFavoriteGameId(null)}
                >
                  Clear selection
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {showModerationTab ? (
        <div
          id="profile-panel-moderation"
          role="tabpanel"
          aria-labelledby="profile-tab-moderation"
          hidden={editTab !== 'moderation'}
          className="profile-edit-tab-panel"
        >
          {profile?.is_admin ? (
            <section className="section">
              <h2>Site administration</h2>
              <p className="muted small">
                Manage contests, the games catalog, and registered accounts.
              </p>
              <ul className="profile-moderation-links">
                <li>
                  <Link to="/admin/contests">Contests</Link>
                </li>
                <li>
                  <Link to="/admin/games">Games</Link>
                </li>
                <li>
                  <Link to="/admin/users">Users</Link>
                </li>
              </ul>
            </section>
          ) : (
            <section className="section">
              <h2>Contests you moderate</h2>
              <p className="muted small">
                Open a contest to edit tracks and metadata, or open grading to score submissions.
              </p>
              <ul className="profile-moderation-links">
                {moderatedContests.map((contest) => (
                  <li key={contest.id}>
                    <Link to={`/admin/contests/${contest.id}`}>{contest.title}</Link>
                    <span className="muted small"> · </span>
                    <Link to={`/admin/contests/${contest.id}/grade`} className="muted small">
                      Grade
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </div>
  )
}
