import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import type { Contest, GradingMark, Submission, SubmissionGuess, Track } from '../lib/types'
import { computeProfileContestStats, type ProfileContestStatsResult } from '../lib/profileContestStats'
import { computeProfileRpgStats } from '../lib/profileRpgStats'
import { avatarPublicUrl } from '../lib/avatar'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../lib/displayNameStyle'
import { DisplayNameStyled } from '../components/DisplayNameStyled'

type ProfileJson = {
  id: string
  username: string
  display_name: string
  bio: string | null
  player_number: number
  created_at: string
  avatar_path?: string | null
  is_admin?: boolean
  is_contest_moderator?: boolean
  favorite_soundtrack_cover_url?: string | null
}

type ProfileStats = {
  my_submissions: Submission[]
  contests: Contest[]
  tracks: Track[]
  submissions: Submission[]
  marks: GradingMark[]
  guesses: SubmissionGuess[]
}

type PublicProfileRpcResponse = {
  profile: ProfileJson
  stats: {
    my_submissions?: Submission[]
    contests?: Contest[]
    tracks?: Track[]
    submissions?: Submission[]
    marks?: GradingMark[]
    guesses?: SubmissionGuess[]
  }
}

function ProfileContestTotals({ stats }: { stats: ProfileContestStatsResult }) {
  return (
    <>
      <h2>Totals</h2>
      <ul className="muted">
        <li>Correct game guesses: {stats.totalGame}</li>
        <li>Correct franchise guesses: {stats.totalFranchise}</li>
        <li>Solo bonuses: {stats.totalSolo}</li>
      </ul>
      <h3 className="profile-subhead">Correct games by track difficulty</h3>
      <ul className="muted">
        <li>Easy: {stats.byDiff.easy}</li>
        <li>Medium: {stats.byDiff.medium}</li>
        <li>Hard: {stats.byDiff.hard}</li>
        <li>Insane: {stats.byDiff.insane}</li>
        <li>Joke: {stats.byDiff.joke}</li>
        <li>Others: {stats.byDiff.other}</li>
      </ul>
    </>
  )
}

function FavoriteSoundtrackCover({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="profile-favorite-column profile-favorite-column--rpg-row">
      <h2>Favorite soundtrack</h2>
      <div className="profile-favorite-cover">
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      </div>
    </div>
  )
}

function title(profile: ProfileJson): string {
  if (profile.is_admin) return 'Administrator'
  if (profile.is_contest_moderator) return 'Contest Moderator'
  return 'Contestant'
}

export function ProfilePage() {
  const supabase = getSupabase()
  const { userId: sessionUserId } = useAuth()
  const { username: usernameFromRoute } = useParams()
  const [profile, setProfile] = useState<ProfileJson | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [displayNameStyleInfo, setDisplayNameStyleInfo] = useState<DisplayNameStyleInfo | null>(null)

  const contestStats = useMemo(() => {
    if (!stats) return null
    return computeProfileContestStats(
      stats.my_submissions,
      stats.contests,
      stats.tracks,
      stats.submissions,
      stats.marks,
    )
  }, [stats])

  const rpgStats = useMemo(() => {
    if (!stats || contestStats === null) return null
    return computeProfileRpgStats(
      stats.guesses ?? [],
      stats.submissions,
      stats.tracks,
      stats.marks,
      contestStats,
      profile?.player_number ?? 0,
      profile?.id,
    )
  }, [stats, contestStats, profile?.player_number, profile?.id])

  useEffect(() => {
    if (!usernameFromRoute) {
      setProfileLoading(false)
      return
    }

    async function loadPublicProfile() {
      setLoadError(null)
      setDisplayNameStyleInfo(null)
      const { data, error } = await supabase.rpc('get_public_profile_page_data', {
        p_username: usernameFromRoute,
      })
      if (error) {
        setLoadError(error.message)
        setProfile(null)
        setStats(null)
        setProfileLoading(false)
        return
      }
      if (!data || typeof data !== 'object') {
        setProfile(null)
        setStats(null)
        setProfileLoading(false)
        return
      }

      const payload = data as PublicProfileRpcResponse
      setProfile(payload.profile)

      const pid = payload.profile.id
      const { data: styleBlob, error: styleErr } = await supabase.rpc('profile_display_name_styles_for_users', {
        p_user_ids: [pid],
      })
      if (!styleErr) {
        setDisplayNameStyleInfo(displayNameStyleMapFromRpc(styleBlob).get(pid) ?? null)
      }

      const rawStats = payload.stats
      setStats({
        my_submissions: (rawStats?.my_submissions ?? []) as Submission[],
        contests: (rawStats?.contests ?? []) as Contest[],
        tracks: (rawStats?.tracks ?? []) as Track[],
        submissions: (rawStats?.submissions ?? []) as Submission[],
        marks: (rawStats?.marks ?? []) as GradingMark[],
        guesses: (rawStats?.guesses ?? []) as SubmissionGuess[],
      })
      setProfileLoading(false)
    }

    void loadPublicProfile()
  }, [usernameFromRoute, supabase])

  const displayHeading = useMemo(() => profile?.display_name ?? 'Player', [profile])

  const documentTitle = useMemo(
    () => (profile ? pageTitle(profile.display_name) : pageTitle('Player')),
    [profile],
  )

  useDocumentTitle(documentTitle)

  const avatarSrc = useMemo(
    () => (profile ? avatarPublicUrl(supabase, profile.avatar_path) : null),
    [profile, supabase],
  )

  if (profileLoading) {
    return <p className="muted">Loading...</p>
  }

  if (loadError || !profile) {
    return (
      <div className="page">
        <p>{loadError ?? 'Profile not found.'}</p>
        <Link to="/players">Players</Link>
      </div>
    )
  }

  if (!stats || !contestStats || !rpgStats) {
    return <p className="muted">Loading...</p>
  }

  const viewingOwnProfile = sessionUserId !== null && sessionUserId === profile.id
  const experienceBarPercent =
    rpgStats.xpForNextLevel > 0
      ? Math.min(100, (100 * rpgStats.xpIntoLevel) / rpgStats.xpForNextLevel)
      : 0

  return (
    <div className="page">
      <div className="profile-page-top">
        <p className="muted small profile-page-top-back">
          <Link to="/players">← Players</Link>
        </p>
        {viewingOwnProfile ? (
          <Link to="/profile/edit" className="profile-page-edit-link">
            Edit profile
          </Link>
        ) : null}
      </div>
      <div className="profile-rpg-stats-row">
          <div className="profile-totals-column profile-totals-column--rpg-row">
            <ProfileContestTotals stats={contestStats} />
          </div>
          <div className="profile-rpg-ff" aria-label="RPG status">
            <div className="profile-rpg-ff-top">
              <div className="profile-rpg-ff-party">
                <div className="profile-rpg-ff-portrait">
                  {avatarSrc ? (
                    <img
                      key={profile.avatar_path ?? 'avatar'}
                      src={avatarSrc}
                      alt=""
                      className="profile-rpg-ff-avatar"
                      width={96}
                      height={96}
                      decoding="async"
                    />
                  ) : (
                    <span className="profile-rpg-ff-avatar profile-rpg-ff-avatar--empty" aria-hidden />
                  )}
                </div>
                <div className="profile-rpg-ff-primary">
                  <h1 className="profile-rpg-ff-name">
                    <DisplayNameStyled text={displayHeading} info={displayNameStyleInfo} />
                  </h1>
                  <div className="profile-rpg-ff-job-row">
                    <span className="profile-rpg-ff-job">{title(profile)}</span>
                  </div>
                  <div className="profile-rpg-ff-line">
                    <span className="profile-rpg-ff-k">Level</span>
                    <span className="profile-rpg-ff-v">{rpgStats.level}</span>
                  </div>
                  <div className="profile-rpg-ff-line">
                    <span className="profile-rpg-ff-k">HP</span>
                    <span className="profile-rpg-ff-v">
                      {rpgStats.hpCurrent.toLocaleString()} / {rpgStats.hpMax.toLocaleString()}
                    </span>
                  </div>
                  <div className="profile-rpg-ff-line">
                    <span className="profile-rpg-ff-k">MP</span>
                    <span className="profile-rpg-ff-v">
                      {rpgStats.mpCurrent.toLocaleString()} / {rpgStats.mpMax.toLocaleString()}
                    </span>
                  </div>
                  <div className="profile-rpg-ff-exp-block">
                    <div className="profile-rpg-ff-line">
                      <span className="profile-rpg-ff-k">EXP</span>
                      <span className="profile-rpg-ff-v">
                        {rpgStats.xpIntoLevel.toLocaleString()} / {rpgStats.xpForNextLevel.toLocaleString()}
                        <span className="profile-rpg-ff-exp-total"> ({rpgStats.totalXp.toLocaleString()})</span>
                      </span>
                    </div>
                    <div className="profile-rpg-ff-exp-track" aria-hidden>
                      <div className="profile-rpg-ff-exp-fill" style={{ width: `${experienceBarPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="profile-rpg-ff-gp-slot">
                <div className="profile-rpg-ff-minibox profile-rpg-ff-minibox--gp">
                  <div className="profile-rpg-ff-gp-value">{rpgStats.coins.toLocaleString()}</div>
                  <div className="profile-rpg-ff-gp-label">GP</div>
                </div>
              </div>
            </div>
            <div className="profile-rpg-ff-combat" aria-label="Combat parameters">
              <div className="profile-rpg-ff-combat-grid">
                <span>Atk {rpgStats.atk.toLocaleString()}</span>
                <span>Def {rpgStats.def.toLocaleString()}</span>
                <span>Int {rpgStats.int.toLocaleString()}</span>
                <span>MDf {rpgStats.mdf.toLocaleString()}</span>
                <span>Dex {rpgStats.dex.toLocaleString()}</span>
                <span>Lck {rpgStats.lck.toLocaleString()}</span>
                <span>Spd {rpgStats.spd.toLocaleString()}</span>
              </div>
            </div>
            {profile.bio ? (
              <div className="profile-rpg-ff-bio">
                <div className="profile-rpg-ff-bio-label">Bio</div>
                <p className="profile-rpg-ff-bio-text">{profile.bio}</p>
              </div>
            ) : null}
          </div>
          {profile.favorite_soundtrack_cover_url ? (
            <FavoriteSoundtrackCover imageUrl={profile.favorite_soundtrack_cover_url} />
          ) : null}
      </div>

      <section className="section">
        <h2>Contests</h2>
        {contestStats.contests.length === 0 ? (
          <p className="muted">None yet. Go enter some contests!</p>
        ) : (
          <ul className="card-list">
            {contestStats.contests.map(({ contest, rank, total, score }) => (
              <li key={contest.id} className="card">
                <Link to={`/contests/${contest.slug}`}>
                  <span className="card-title">{contest.title}</span>
                  <span className="muted small">
                    {rank > 0 && total > 0 ? (
                      <>
                        Place {rank} / {total} · Score {score.toFixed(1)}
                      </>
                    ) : (
                      <>Score {score.toFixed(1)}</>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
