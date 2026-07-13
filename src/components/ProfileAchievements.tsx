import { useEffect, useMemo, useState } from 'react'
import { computeProfileAchievements, type ProfileAchievement } from '../lib/profileAchievements'
import type { ProfileContestStatsResult } from '../lib/profileContestStats'
import type { ProfileRpgStats } from '../lib/profileRpgStats'
import type { PublicProfileJson } from '../lib/queries/players'
import {
  mergeSecretAchievementIds,
  SECRET_ACHIEVEMENT_UNLOCKED_EVENT,
} from '../lib/secretAchievements'
import { AchievementIcon, achievementTierClass } from './AchievementIcon'
import { ResultsGridHoverTip } from './ContestResultsGridHoverTip'

type Props = {
  profile: PublicProfileJson
  contestStats: ProfileContestStatsResult
  rpg: ProfileRpgStats
  ppRank: number | null
}

function AchievementBadge({ achievement }: { achievement: ProfileAchievement }) {
  const tip = `${achievement.name}: ${achievement.description}`

  return (
    <ResultsGridHoverTip content={tip}>
      <span
        className={['profile-achievement-badge', achievementTierClass(achievement.tier)].join(' ')}
        aria-label={tip}
      >
        <AchievementIcon id={achievement.id} className="profile-achievement-icon" />
      </span>
    </ResultsGridHoverTip>
  )
}

export function ProfileAchievements({ profile, contestStats, rpg, ppRank }: Props) {
  const [secretRevision, setSecretRevision] = useState(0)

  useEffect(() => {
    function onSecretUnlocked(event: Event) {
      const detail = (event as CustomEvent<{ profileId: string }>).detail
      if (detail?.profileId === profile.id) {
        setSecretRevision((value) => value + 1)
      }
    }
    window.addEventListener(SECRET_ACHIEVEMENT_UNLOCKED_EVENT, onSecretUnlocked)
    return () => window.removeEventListener(SECRET_ACHIEVEMENT_UNLOCKED_EVENT, onSecretUnlocked)
  }, [profile.id])

  const secretAchievementIds = useMemo(
    () => mergeSecretAchievementIds(profile.id, profile.secret_achievements),
    [profile.id, profile.secret_achievements, secretRevision],
  )

  const achievements = useMemo(
    () =>
      computeProfileAchievements({
        profile,
        contestStats,
        rpg,
        ppRank,
        secretAchievementIds,
      }),
    [profile, contestStats, rpg, ppRank, secretAchievementIds],
  )

  if (achievements.length === 0) return null

  return (
    <div className="profile-achievements" aria-label="Achievements">
      {achievements.map((achievement) => (
        <AchievementBadge key={achievement.id} achievement={achievement} />
      ))}
    </div>
  )
}
