import { useMemo } from 'react'
import { computeProfileAchievements, type ProfileAchievement } from '../lib/profileAchievements'
import type { ProfileContestStatsResult } from '../lib/profileContestStats'
import type { ProfileRpgStats } from '../lib/profileRpgStats'
import type { PublicProfileJson } from '../lib/queries/players'
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
  const achievements = useMemo(
    () => computeProfileAchievements({ profile, contestStats, rpg, ppRank }),
    [profile, contestStats, rpg, ppRank],
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
