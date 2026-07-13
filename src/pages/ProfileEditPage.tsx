import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { avatarPublicUrl, resizeImageFileToAvatarJpeg } from '../lib/avatar'
import type { DisplayNameEffect, Profile, SiteBackgroundPattern } from '../lib/types'
import {
  normalizeDisplayNameHex,
  parseDisplayNameEffect,
  type DisplayNameStyleInfo,
} from '../lib/displayNameStyle'
import { contestClosed } from '../lib/deadline'
import { tabButtonClass } from '../lib/tabButtonClass'
import { useAuth } from '../auth/AuthContext'
import {
  DEFAULT_SITE_BACKGROUND_PATTERN,
  parseSiteBackgroundPattern,
} from '../theme/siteBackground'
import { useToast } from '../toast/ToastContext'
import {
  useFavoriteSoundtrackGames,
  useMyContestSubmissions,
  useProfileNameStyleCaps,
} from '../hooks/useProfileEditQueries'
import { ProfileEditAppearanceTab } from './profileEdit/ProfileEditAppearanceTab'
import { ProfileEditBasicTab } from './profileEdit/ProfileEditBasicTab'
import { ProfileEditFunTab } from './profileEdit/ProfileEditFunTab'
import { ProfileEditModerationTab } from './profileEdit/ProfileEditModerationTab'
import { ProfileEditPrivateTab } from './profileEdit/ProfileEditPrivateTab'
import { ProfileEditSubmissionsTab } from './profileEdit/ProfileEditSubmissionsTab'
import {
  type EditTab,
  type MyContestSubmissionRow,
  PROFILE_SECTION_TABS,
  USERNAME_REGEX,
  parseEditTab,
} from './profileEdit/shared'

export function ProfileEditPage() {
  useDocumentTitle(pageTitle('Your profile'))
  const supabase = getSupabase()
  const { sessionReady, userId, session, profile: authProfile, refreshProfile, hasModerationAccess, moderatedContests } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = parseEditTab(searchParams.get('tab'))
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const { success: toastSuccess } = useToast()
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [gameSearch, setGameSearch] = useState('')
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [editTab, setEditTab] = useState<EditTab>('basic')
  const [notifyNewContestEmail, setNotifyNewContestEmail] = useState(false)
  const [notifyEmailBusy, setNotifyEmailBusy] = useState(false)
  const [siteBackgroundPattern, setSiteBackgroundPattern] = useState<SiteBackgroundPattern>(
    DEFAULT_SITE_BACKGROUND_PATTERN,
  )
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [alwaysRevealSpoilers, setAlwaysRevealSpoilers] = useState(false)
  const [behaviorBusy, setBehaviorBusy] = useState(false)
  const [nameColor1, setNameColor1] = useState('')
  const [nameColor2, setNameColor2] = useState('')
  const [nameEffect, setNameEffect] = useState<DisplayNameEffect>('none')

  const { data: styleCaps = { canGradient: false, canEffect: false } } = useProfileNameStyleCaps(profile?.id)
  const {
    data: mySubmissionsData,
    isLoading: submissionsLoading,
    error: submissionsQueryError,
  } = useMyContestSubmissions(profile?.id)
  const mySubmissions = submissionsLoading ? null : (mySubmissionsData ?? [])
  const submissionsLoadError =
    submissionsQueryError instanceof Error ? submissionsQueryError.message : null
  const {
    data: games = [],
    isLoading: gamesLoading,
    error: gamesQueryError,
  } = useFavoriteSoundtrackGames(profile?.id)
  const gamesLoadError = gamesQueryError instanceof Error ? gamesQueryError.message : null

  const clearFeedback = useCallback(() => {
    setPageError(null)
  }, [])

  useEffect(() => {
    setEmail(session?.user?.email ?? '')
  }, [session?.user?.email])

  useEffect(() => {
    if (!authProfile) return
    const loaded = authProfile
    setProfile(loaded)
    setUsername(loaded.username ?? '')
    setDisplayName(loaded.display_name ?? '')
    setBio(loaded.bio ?? '')
    setFavoriteGameId(loaded.favorite_soundtrack_game_id ?? null)
    setNotifyNewContestEmail(Boolean(loaded.notify_new_contest_email))
    setSiteBackgroundPattern(parseSiteBackgroundPattern(loaded.site_background_pattern))
    setAlwaysRevealSpoilers(Boolean(loaded.always_reveal_spoilers))
    setNameColor1(loaded.display_name_color?.trim() ?? '')
    setNameColor2(loaded.display_name_color_2?.trim() ?? '')
    setNameEffect(parseDisplayNameEffect(loaded.display_name_effect))
  }, [authProfile])

  useEffect(() => {
    if (!hasModerationAccess && editTab === 'moderation') {
      setEditTab('basic')
    }
  }, [hasModerationAccess, editTab])

  useEffect(() => {
    if (!tabFromUrl) return
    if (tabFromUrl === 'moderation' && !hasModerationAccess) return
    setEditTab(tabFromUrl)
  }, [tabFromUrl, hasModerationAccess])

  const avatarPreview = useMemo(
    () => (profile ? avatarPublicUrl(supabase, profile.avatar_path) : null),
    [profile, supabase],
  )

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

  const nameStylePreviewInfo = useMemo((): DisplayNameStyleInfo => {
    return {
      color1: normalizeDisplayNameHex(nameColor1 || null),
      color2: styleCaps.canGradient ? normalizeDisplayNameHex(nameColor2 || null) : null,
      effect: styleCaps.canEffect ? nameEffect : 'none',
    }
  }, [nameColor1, nameColor2, nameEffect, styleCaps.canEffect, styleCaps.canGradient])

  const saveAppearance = useCallback(async () => {
    if (!profile) return
    clearFeedback()
    setAppearanceBusy(true)
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ site_background_pattern: siteBackgroundPattern })
      .eq('id', profile.id)
      .select('*')
      .single()
    setAppearanceBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setProfile(updated as Profile)
    await refreshProfile()
    toastSuccess('Theme saved.')
  }, [clearFeedback, profile, refreshProfile, siteBackgroundPattern, supabase])

  const saveBehavior = useCallback(async () => {
    if (!profile) return
    clearFeedback()
    setBehaviorBusy(true)
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ always_reveal_spoilers: alwaysRevealSpoilers })
      .eq('id', profile.id)
      .select('*')
      .single()
    setBehaviorBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setProfile(updated as Profile)
    await refreshProfile()
    toastSuccess('Behavior saved.')
  }, [alwaysRevealSpoilers, clearFeedback, profile, refreshProfile, supabase])

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
    toastSuccess('Favorite soundtrack saved.')
  }, [clearFeedback, favoriteGameId, profile, supabase])

  async function savePublic(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    clearFeedback()
    const trimmedUsername = username.trim()
    if (trimmedUsername && !USERNAME_REGEX.test(trimmedUsername)) {
      setPageError('Username: 2-32 characters, letters, digits, or underscore.')
      return
    }
    setSubmitBusy(true)
    const previousTrimmed = (profile.username ?? '').trim()
    if (trimmedUsername.toLowerCase() !== previousTrimmed.toLowerCase()) {
      const { data: usernameAvailable } = await supabase.rpc('username_is_available', {
        p_username: trimmedUsername,
      })
      if (usernameAvailable === false) {
        setSubmitBusy(false)
        setPageError('That username is taken.')
        return
      }
    }
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        display_name_color: normalizeDisplayNameHex(nameColor1 || null),
        display_name_color_2: styleCaps.canGradient ? normalizeDisplayNameHex(nameColor2 || null) : null,
        display_name_effect: styleCaps.canEffect ? nameEffect : 'none',
      })
      .eq('id', profile.id)
      .select('*')
      .single()
    setSubmitBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    const row = updated as Profile
    setProfile(row)
    setNameColor1(row.display_name_color?.trim() ?? '')
    setNameColor2(row.display_name_color_2?.trim() ?? '')
    setNameEffect(parseDisplayNameEffect(row.display_name_effect))
    await refreshProfile()
    toastSuccess('Profile saved.')
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
    toastSuccess(
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
    toastSuccess('Check your inbox to confirm the new email if required.')
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
    toastSuccess('Password updated.')
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
      toastSuccess('Profile picture updated.')
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
    toastSuccess('Profile picture removed.')
  }

  if (!sessionReady) {
    return <p className="muted">Loading...</p>
  }
  if (!userId) {
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
        {hasModerationAccess ? (
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

      <ProfileEditBasicTab
        active={editTab === 'basic'}
        profile={profile}
        avatarPreview={avatarPreview}
        avatarBusy={avatarBusy}
        username={username}
        displayName={displayName}
        bio={bio}
        nameColor1={nameColor1}
        nameColor2={nameColor2}
        nameEffect={nameEffect}
        styleCaps={styleCaps}
        nameStylePreviewInfo={nameStylePreviewInfo}
        submitBusy={submitBusy}
        onUsernameChange={setUsername}
        onDisplayNameChange={setDisplayName}
        onBioChange={setBio}
        onNameColor1Change={setNameColor1}
        onNameColor2Change={setNameColor2}
        onNameEffectChange={setNameEffect}
        onAvatarFile={onAvatarFile}
        onRemoveAvatar={removeAvatar}
        onSavePublic={savePublic}
      />

      <ProfileEditPrivateTab
        active={editTab === 'private'}
        profile={profile}
        email={email}
        newPassword={newPassword}
        passwordConfirm={passwordConfirm}
        notifyNewContestEmail={notifyNewContestEmail}
        submitBusy={submitBusy}
        notifyEmailBusy={notifyEmailBusy}
        onEmailChange={setEmail}
        onNewPasswordChange={setNewPassword}
        onPasswordConfirmChange={setPasswordConfirm}
        onSaveEmail={saveEmail}
        onSavePassword={savePassword}
        onNotifyNewContestEmailChange={saveNotifyNewContestEmail}
      />

      <ProfileEditSubmissionsTab
        active={editTab === 'submissions'}
        submissionsLoadError={submissionsLoadError}
        mySubmissions={mySubmissions}
        openSubmissions={openSubmissions}
        closedSubmissions={closedSubmissions}
      />

      <ProfileEditAppearanceTab
        active={editTab === 'appearance'}
        profile={profile}
        alwaysRevealSpoilers={alwaysRevealSpoilers}
        siteBackgroundPattern={siteBackgroundPattern}
        behaviorBusy={behaviorBusy}
        appearanceBusy={appearanceBusy}
        onAlwaysRevealSpoilersChange={setAlwaysRevealSpoilers}
        onSiteBackgroundPatternChange={setSiteBackgroundPattern}
        onSaveBehavior={saveBehavior}
        onSaveAppearance={saveAppearance}
      />

      <ProfileEditFunTab
        active={editTab === 'fun'}
        profile={profile}
        gamesLoadError={gamesLoadError}
        gamesLoading={gamesLoading}
        games={games}
        gameSearch={gameSearch}
        favoriteGameId={favoriteGameId}
        selectedGame={selectedGame ?? null}
        filteredGames={filteredGames}
        favoriteBusy={favoriteBusy}
        onGameSearchChange={setGameSearch}
        onFavoriteGameIdChange={setFavoriteGameId}
        onSaveFavorite={saveFavorite}
      />

      {hasModerationAccess ? (
        <ProfileEditModerationTab
          active={editTab === 'moderation'}
          profile={profile}
          moderatedContests={moderatedContests}
        />
      ) : null}
    </div>
  )
}
