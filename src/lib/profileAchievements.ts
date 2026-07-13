import type { ProfileContestStatsResult } from './profileContestStats'
import type { ProfileRpgStats } from './profileRpgStats'
import type { PublicProfileJson } from './queries/players'

export type AchievementTier = 'common' | 'uncommon' | 'rare' | 'legendary' | 'role'

export type AchievementId =
  | 'administrator'
  | 'host'
  | 'first_contest'
  | 'regular'
  | 'dedicated'
  | 'veteran'
  | 'archivist'
  | 'champion'
  | 'podium'
  | 'contender'
  | 'clean_sweep'
  | 'high_score'
  | 'sharp_ears'
  | 'keen_ear_100'
  | 'keen_ear_250'
  | 'keen_ear_500'
  | 'franchise_scout_10'
  | 'franchise_scout_50'
  | 'lone_wolf'
  | 'solo_specialist_10'
  | 'solo_specialist_25'
  | 'solo_ace'
  | 'hard_mode'
  | 'insane_slayer'
  | 'insane_master'
  | 'jokes_on_you'
  | 'level_10'
  | 'level_25'
  | 'level_50'
  | 'pp_elite'
  | 'pp_contender'
  | 'wealthy_adventurer'
  | 'soundtrack_soul'
  | 'face_card'
  | 'wordsmith'
  | 'bill_rizer'

export type ProfileAchievement = {
  id: AchievementId
  name: string
  description: string
  tier: AchievementTier
}

type ProfileAchievementContext = {
  contestStats: ProfileContestStatsResult
  rpg: ProfileRpgStats
  profile: PublicProfileJson
  ppRank: number | null
  secretAchievementIds?: AchievementId[]
}

type AchievementDef = ProfileAchievement & {
  sortOrder: number
  check: (ctx: ProfileAchievementContext) => boolean
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'administrator',
    name: 'Administrator',
    description: 'Site administrator.',
    tier: 'role',
    sortOrder: 10,
    check: ({ profile }) => Boolean(profile.is_admin),
  },
  {
    id: 'host',
    name: 'Host',
    description: 'Contest moderator.',
    tier: 'role',
    sortOrder: 20,
    check: ({ profile }) => Boolean(profile.is_contest_moderator),
  },
  {
    id: 'first_contest',
    name: 'First Contest',
    description: 'Entered a first contest.',
    tier: 'common',
    sortOrder: 100,
    check: ({ contestStats }) => contestStats.contests.length >= 1,
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Entered 5 contests.',
    tier: 'common',
    sortOrder: 110,
    check: ({ contestStats }) => contestStats.contests.length >= 5,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Entered 10 contests.',
    tier: 'common',
    sortOrder: 120,
    check: ({ contestStats }) => contestStats.contests.length >= 10,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Entered 25 contests.',
    tier: 'uncommon',
    sortOrder: 130,
    check: ({ contestStats }) => contestStats.contests.length >= 25,
  },
  {
    id: 'archivist',
    name: 'Archivist',
    description: 'Entered 50 contests.',
    tier: 'rare',
    sortOrder: 140,
    check: ({ contestStats }) => contestStats.contests.length >= 50,
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Won 1st place in a contest.',
    tier: 'legendary',
    sortOrder: 200,
    check: ({ contestStats }) => contestStats.contests.some((row) => row.rank === 1),
  },
  {
    id: 'podium',
    name: 'Podium',
    description: 'Finished in the top 3 of a contest.',
    tier: 'rare',
    sortOrder: 210,
    check: ({ contestStats }) => contestStats.contests.some((row) => row.rank > 0 && row.rank <= 3),
  },
  {
    id: 'contender',
    name: 'Contender',
    description: 'Finished in the top 10 of a contest.',
    tier: 'uncommon',
    sortOrder: 220,
    check: ({ contestStats }) => contestStats.contests.some((row) => row.rank > 0 && row.rank <= 10),
  },
  {
    id: 'clean_sweep',
    name: 'Clean Sweep',
    description: 'Got every track correct (game) in a single contest.',
    tier: 'legendary',
    sortOrder: 230,
    check: ({ contestStats }) =>
      contestStats.contests.some(
        (row) =>
          row.trackCount != null &&
          row.trackCount > 0 &&
          row.correctGames != null &&
          row.correctGames === row.trackCount,
      ),
  },
  {
    id: 'high_score',
    name: 'High Score',
    description: 'Scored at least 90% of the maximum possible in a contest.',
    tier: 'rare',
    sortOrder: 240,
    check: ({ contestStats }) =>
      contestStats.contests.some((row) => {
        if (row.trackCount == null || row.trackCount <= 0) return false
        const maxScore = row.trackCount * 1.5
        return row.score >= maxScore * 0.9
      }),
  },
  {
    id: 'sharp_ears',
    name: 'Sharp Ears',
    description: '25 correct game guesses.',
    tier: 'common',
    sortOrder: 300,
    check: ({ contestStats }) => contestStats.totalGame >= 25,
  },
  {
    id: 'keen_ear_100',
    name: 'Keen Ear',
    description: '100 correct game guesses.',
    tier: 'uncommon',
    sortOrder: 310,
    check: ({ contestStats }) => contestStats.totalGame >= 100,
  },
  {
    id: 'keen_ear_250',
    name: 'Keen Ear II',
    description: '250 correct game guesses.',
    tier: 'rare',
    sortOrder: 320,
    check: ({ contestStats }) => contestStats.totalGame >= 250,
  },
  {
    id: 'keen_ear_500',
    name: 'Keen Ear III',
    description: '500 correct game guesses.',
    tier: 'legendary',
    sortOrder: 330,
    check: ({ contestStats }) => contestStats.totalGame >= 500,
  },
  {
    id: 'franchise_scout_10',
    name: 'Franchise Scout',
    description: '10 correct franchise guesses.',
    tier: 'common',
    sortOrder: 340,
    check: ({ contestStats }) => contestStats.totalFranchise >= 10,
  },
  {
    id: 'franchise_scout_50',
    name: 'Franchise Scout II',
    description: '50 correct franchise guesses.',
    tier: 'uncommon',
    sortOrder: 350,
    check: ({ contestStats }) => contestStats.totalFranchise >= 50,
  },
  {
    id: 'lone_wolf',
    name: 'Lone Wolf',
    description: 'Earned a first solo bonus.',
    tier: 'common',
    sortOrder: 360,
    check: ({ contestStats }) => contestStats.totalSolo >= 1,
  },
  {
    id: 'solo_specialist_10',
    name: 'Solo Specialist',
    description: '10 solo bonuses.',
    tier: 'uncommon',
    sortOrder: 370,
    check: ({ contestStats }) => contestStats.totalSolo >= 10,
  },
  {
    id: 'solo_specialist_25',
    name: 'Solo Specialist II',
    description: '25 solo bonuses.',
    tier: 'rare',
    sortOrder: 380,
    check: ({ contestStats }) => contestStats.totalSolo >= 25,
  },
  {
    id: 'solo_ace',
    name: 'Solo Ace',
    description: '3 or more solo bonuses in a single contest.',
    tier: 'rare',
    sortOrder: 390,
    check: ({ contestStats }) => contestStats.contests.some((row) => (row.solo ?? 0) >= 3),
  },
  {
    id: 'hard_mode',
    name: 'Hard Mode',
    description: '10 correct hard-difficulty tracks.',
    tier: 'uncommon',
    sortOrder: 400,
    check: ({ contestStats }) => contestStats.byDiff.hard >= 10,
  },
  {
    id: 'insane_slayer',
    name: 'Insane Slayer',
    description: '10 correct insane-difficulty tracks.',
    tier: 'rare',
    sortOrder: 410,
    check: ({ contestStats }) => contestStats.byDiff.insane >= 10,
  },
  {
    id: 'insane_master',
    name: 'Insane Master',
    description: '25 correct insane-difficulty tracks.',
    tier: 'legendary',
    sortOrder: 420,
    check: ({ contestStats }) => contestStats.byDiff.insane >= 25,
  },
  {
    id: 'jokes_on_you',
    name: "Joke's On You",
    description: '5 correct joke-difficulty tracks.',
    tier: 'uncommon',
    sortOrder: 430,
    check: ({ contestStats }) => contestStats.byDiff.joke >= 5,
  },
  {
    id: 'level_10',
    name: 'Level 10',
    description: 'Reached level 10.',
    tier: 'common',
    sortOrder: 500,
    check: ({ rpg }) => rpg.level >= 10,
  },
  {
    id: 'level_25',
    name: 'Level 25',
    description: 'Reached level 25.',
    tier: 'uncommon',
    sortOrder: 510,
    check: ({ rpg }) => rpg.level >= 25,
  },
  {
    id: 'level_50',
    name: 'Level 50',
    description: 'Reached level 50.',
    tier: 'legendary',
    sortOrder: 520,
    check: ({ rpg }) => rpg.level >= 50,
  },
  {
    id: 'pp_elite',
    name: 'PP Elite',
    description: 'Ranked in the top 10 by performance points.',
    tier: 'legendary',
    sortOrder: 530,
    check: ({ ppRank }) => ppRank != null && ppRank <= 10,
  },
  {
    id: 'pp_contender',
    name: 'PP Contender',
    description: 'Ranked in the top 25 by performance points.',
    tier: 'rare',
    sortOrder: 540,
    check: ({ ppRank }) => ppRank != null && ppRank <= 25,
  },
  {
    id: 'wealthy_adventurer',
    name: 'Wealthy Adventurer',
    description: 'Accumulated 10,000 GP.',
    tier: 'uncommon',
    sortOrder: 550,
    check: ({ rpg }) => rpg.coins >= 10_000,
  },
  {
    id: 'soundtrack_soul',
    name: 'Soundtrack Soul',
    description: 'Set a favorite soundtrack on their profile.',
    tier: 'common',
    sortOrder: 600,
    check: ({ profile }) => Boolean(profile.favorite_soundtrack_cover_url?.trim()),
  },
  {
    id: 'face_card',
    name: 'Face Card',
    description: 'Uploaded a profile avatar.',
    tier: 'common',
    sortOrder: 610,
    check: ({ profile }) => Boolean(profile.avatar_path?.trim()),
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    description: 'Wrote a profile bio.',
    tier: 'common',
    sortOrder: 620,
    check: ({ profile }) => Boolean(profile.bio?.trim()),
  },
  {
    id: 'bill_rizer',
    name: 'Bill Rizer',
    description: '?',
    tier: 'legendary',
    sortOrder: 900,
    check: ({ secretAchievementIds }) => secretAchievementIds?.includes('bill_rizer') ?? false,
  },
]

export function computeProfileAchievements(ctx: ProfileAchievementContext): ProfileAchievement[] {
  return ACHIEVEMENT_DEFS.filter((def) => def.check(ctx))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, name, description, tier }) => ({ id, name, description, tier }))
}
