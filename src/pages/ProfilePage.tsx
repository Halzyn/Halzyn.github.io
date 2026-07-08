import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import type { ProfileContestStatsResult } from '../lib/profileContestStats'
import type { ProfileRpgStats } from '../lib/profileRpgStats'
import { avatarPublicUrl } from '../lib/avatar'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../lib/displayNameStyle'
import { computePpRankByUserId } from '../lib/performancePoints'
import type { PublicProfile } from '../lib/types'
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

type PrecomputedProfileStats = {
  performance_points: number
  contest: ProfileContestStatsResult
  rpg: ProfileRpgStats
}

type PublicProfileRpcResponse = {
  profile: ProfileJson
  stats: PrecomputedProfileStats
}

function ProfileStatsPanel({ stats }: { stats: ProfileContestStatsResult }) {
  return (
    <>
      <h2>Stats</h2>
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
  const { username: usernameFromRoute } = useParams()
  const [profile, setProfile] = useState<ProfileJson | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [stats, setStats] = useState<PrecomputedProfileStats | null>(null)
  const [ppRank, setPpRank] = useState<number | null>(null)
  const [displayNameStyleInfo, setDisplayNameStyleInfo] = useState<DisplayNameStyleInfo | null>(null)

  const contestStats = stats?.contest ?? null
  const rpgStats = stats?.rpg ?? null
  const performancePoints = stats?.performance_points ?? null

  useEffect(() => {
    if (!usernameFromRoute) {
      setProfileLoading(false)
      return
    }

    async function loadPublicProfile() {
      setLoadError(null)
      setDisplayNameStyleInfo(null)
      setPpRank(null)
      const [{ data, error }, { data: playersData, error: playersError }] = await Promise.all([
        supabase.rpc('get_public_profile_page_data', {
          p_username: usernameFromRoute,
        }),
        supabase.rpc('list_players_public'),
      ])
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

      setStats(payload.stats)
      if (!playersError && playersData) {
        const rank = computePpRankByUserId(playersData as PublicProfile[]).get(pid) ?? null
        setPpRank(rank)
      }
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

  const experienceBarPercent =
    rpgStats.xpForNextLevel > 0
      ? Math.min(100, (100 * rpgStats.xpIntoLevel) / rpgStats.xpForNextLevel)
      : 0

  return (
    <div className="page">
      <div className="profile-rpg-stats-row">
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
                  <div className="profile-rpg-ff-job-row">
                    <span className="profile-rpg-ff-rank-pp">
                      {ppRank != null ? `Rank #${ppRank}` : 'Rank —'} ◦ {(performancePoints ?? 0).toFixed(2)}pp
                    </span>
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
          <div className="profile-totals-column profile-totals-column--rpg-row">
            <ProfileStatsPanel stats={contestStats} />
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
            {contestStats.contests.map(({ contest, rank, total, score, pp }) => (
              <li key={contest.id} className="card">
                <Link to={`/contests/${contest.slug}`} className="profile-contest-card-link">
                  <span className="profile-contest-card-text">
                    <span className="card-title">{contest.title}</span>
                    <span className="muted small">
                      {rank > 0 && total > 0 ? (
                        <>Place {rank} / {total} ◦ Score {score.toFixed(1)}</>
                      ) : (
                        <>Score {score.toFixed(1)}</>
                      )}
                    </span>
                  </span>
                  <span className="player-card-pp">{(pp ?? 0).toFixed(2)}pp</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
