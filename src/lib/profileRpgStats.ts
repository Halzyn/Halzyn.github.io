/**
 * Quick overview of the RPG calculation
 *
 * Inputs
 * - Correct guesses and franchise guesses
 *
 * XP per guess
 * Track diff base XP * franchise or game multiplier * solo bonus
 *
 * Level
 * Each level up requires floor(xpToLevelUp(level) * curve)
 * XP to level up is floor(36 + 15n + 0.35n²), where n is the current level. Minimum is 24.
 *
 * HP is 22 + floor(4 * level + 0.75 * (games + franchises))
 * MP is 14 + floor(3 * level + 0.5 * (games + franchises))
 * Attack is 4 + floor(level * 1.15) + floor(insane * 1.4 + hard * 0.95 + medium * 0.55 + (easy + joke) * 0.3 + other * 0.45)
 * Defense is 5 + floor(level * 1.1) + floor(games * 0.38 + franchises * 0.32 + solo * 0.12)
 * Intelligence is 4 + floor(level * 0.85) + floor(franchises * 0.8 + medium * 0.38 + (games + franchises) * 0.08)
 * Magic defense is 4 + floor(level * 0.9) + floor((games + franchises) * 0.2 + hard * 0.48 + insane * 0.34)
 * Dexterity is 4 + floor(level * 0.9) + floor(solo * 0.82 + (easy + joke) * 0.26 + games * 0.06)
 * Luck is 3 + floor(level * 0.55) + (playerNumber % 8) + floor(solo * 0.35) + ((Math.floor(totalXp) % 97) % 7) + (games % 5)
 * Speed is 4 + level + floor(games * 0.13 + franchises * 0.1 + solo * 0.44) + floor((games + franchises) / 24)
 * Coins is floor(totalXp * 0.12 + games * 8 + franchises * 6 + solo * 15)
 * These then get tilted by RESOURCE_SPREAD.
 *
 * Stats and level up curves scale per player based on their player number
 */
import type { ProfileContestStatsResult } from './profileContestStats'
import type { GradingMark, Submission, SubmissionGuess, Track } from './types'
import { difficulty, type Difficulty } from './difficulty'
import { soloGameWinnerByTrack } from './scoring'
import { pushToMappedList } from './utils'

const XP_BY_DIFF: Record<Difficulty, number> = {
  easy: 12,
  joke: 12,
  medium: 18,
  hard: 28,
  insane: 42,
  other: 12,
}

const SOLO_XP_MULT = 1.5
const FRANCHISE_XP_MULT = 0.5

const SALT = {
  atk: 11,
  def: 13,
  int: 17,
  mdf: 19,
  dex: 23,
  lck: 29,
  spd: 31,
  coins: 37,
  xpCurve: 41,
  hp: 43,
  mp: 47,
} as const

const STAT_SPREAD = 0.085
const RESOURCE_SPREAD = 0.06
const LEVEL_COST_SPREAD = 0.055
const LCK_SPREAD = STAT_SPREAD * 0.65
const COINS_SPREAD = STAT_SPREAD * 0.75

function xpToLevelUp(level: number): number {
  return Math.max(24, Math.floor(36 + level * 15 + level * level * 0.35))
}

function mixPlayerSeed(profileId: string | undefined, playerNumber: number): number {
  if (!profileId) {
    return Math.imul(playerNumber ^ 0x9e3779b1, 0x85ebca6b) >>> 0
  }
  let hash = playerNumber >>> 0
  for (let i = 0; i < profileId.length; i++) {
    hash ^= profileId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function unitNoise(seed: number, salt: number): number {
  let x = Math.imul(seed ^ salt, 0x9e3779b1) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b) >>> 0
  x ^= x >>> 13
  x ^= x >>> 17
  return (x >>> 0) / 4294967296
}

function tiltInteger(base: number, seed: number, salt: number, spread: number): number {
  const multiplier = 1 - spread + unitNoise(seed, salt) * (2 * spread)
  return Math.round(base * multiplier)
}

function guessMarkKey(submissionId: string, trackId: string): string {
  return `${submissionId}\0${trackId}`
}

export type ProfileRpgStats = {
  correctGuesses: number
  totalXp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  hpCurrent: number
  hpMax: number
  mpCurrent: number
  mpMax: number
  atk: number
  def: number
  int: number
  mdf: number
  dex: number
  lck: number
  spd: number
  coins: number
}

function levelProgress(
  totalXp: number,
  seed: number,
): Pick<ProfileRpgStats, 'level' | 'xpIntoLevel' | 'xpForNextLevel'> {
  const curve = 1 - LEVEL_COST_SPREAD + unitNoise(seed, SALT.xpCurve) * (2 * LEVEL_COST_SPREAD)

  let level = 1
  let rest = totalXp
  for (;;) {
    const need = Math.max(1, Math.floor(xpToLevelUp(level) * curve))
    if (rest < need) {
      return { level, xpIntoLevel: rest, xpForNextLevel: need }
    }
    rest -= need
    level++
    if (level > 9998) {
      return { level: 9999, xpIntoLevel: 0, xpForNextLevel: 1 }
    }
  }
}

function combatStatsFromContest(
  agg: ProfileContestStatsResult,
  level: number,
  totalXp: number,
  playerNumber: number,
  seed: number,
): Pick<
  ProfileRpgStats,
  'atk' | 'def' | 'int' | 'mdf' | 'dex' | 'lck' | 'spd' | 'coins'
> {
  const { byDiff, totalGame: games, totalFranchise: franchises, totalSolo: solo } = agg

  const atkRaw =
    4 +
    Math.floor(level * 1.15) +
    Math.floor(
      byDiff.insane * 1.4 +
        byDiff.hard * 0.95 +
        byDiff.medium * 0.55 +
        (byDiff.easy + byDiff.joke) * 0.3 +
        byDiff.other * 0.45,
    )

  const defRaw =
    5 + Math.floor(level * 1.1) + Math.floor(games * 0.38 + franchises * 0.32 + solo * 0.12)

  const intRaw =
    4 +
    Math.floor(level * 0.85) +
    Math.floor(franchises * 0.8 + byDiff.medium * 0.38 + (games + franchises) * 0.08)

  const mdfRaw =
    4 +
    Math.floor(level * 0.9) +
    Math.floor((games + franchises) * 0.2) +
    Math.floor(byDiff.hard * 0.48 + byDiff.insane * 0.34)

  const dexRaw =
    4 +
    Math.floor(level * 0.9) +
    Math.floor(solo * 0.82 + (byDiff.easy + byDiff.joke) * 0.26 + games * 0.06)

  const lckRaw =
    3 +
    Math.floor(level * 0.55) +
    (playerNumber % 8) +
    Math.floor(solo * 0.35) +
    ((Math.floor(totalXp) % 97) % 7) +
    (games % 5)

  const spdRaw =
    4 +
    level +
    Math.floor(games * 0.13 + franchises * 0.1 + solo * 0.44) +
    Math.floor((games + franchises) / 24)

  const coinsRaw = Math.floor(totalXp * 0.12 + games * 8 + franchises * 6 + solo * 15)

  return {
    atk: tiltInteger(atkRaw, seed, SALT.atk, STAT_SPREAD),
    def: tiltInteger(defRaw, seed, SALT.def, STAT_SPREAD),
    int: tiltInteger(intRaw, seed, SALT.int, STAT_SPREAD),
    mdf: tiltInteger(mdfRaw, seed, SALT.mdf, STAT_SPREAD),
    dex: tiltInteger(dexRaw, seed, SALT.dex, STAT_SPREAD),
    lck: tiltInteger(lckRaw, seed, SALT.lck, LCK_SPREAD),
    spd: tiltInteger(spdRaw, seed, SALT.spd, STAT_SPREAD),
    coins: tiltInteger(coinsRaw, seed, SALT.coins, COINS_SPREAD),
  }
}

export function computeProfileRpgStats(
  guesses: SubmissionGuess[],
  submissionsInContests: Submission[],
  tracks: Track[],
  marks: GradingMark[],
  contestAgg: ProfileContestStatsResult,
  playerNumber: number | null | undefined,
  profileId?: string | null,
): ProfileRpgStats {
  const pn = playerNumber ?? 0
  const seed = mixPlayerSeed(profileId ?? undefined, pn)

  const submissionToContestId = new Map(submissionsInContests.map((submission) => [submission.id, submission.contest_id]))

  const markKindByGuessKey = new Map<string, 'game' | 'franchise'>()
  const marksByContest = new Map<string, GradingMark[]>()
  for (const mark of marks) {
    markKindByGuessKey.set(guessMarkKey(mark.submission_id, mark.track_id), mark.mark)
    const contestId = submissionToContestId.get(mark.submission_id)
    if (contestId) pushToMappedList(marksByContest, contestId, mark)
  }

  const trackById = new Map(tracks.map((track) => [track.id, track]))

  let totalXp = 0
  let correctGuesses = 0
  for (const guess of guesses) {
    const kind = markKindByGuessKey.get(guessMarkKey(guess.submission_id, guess.track_id))
    if (!kind) continue

    const contestId = submissionToContestId.get(guess.submission_id)
    if (!contestId) continue

    correctGuesses++
    const track = trackById.get(guess.track_id)
    const baseXp = XP_BY_DIFF[difficulty(track?.difficulty)]

    const soloWinnersByTrack = soloGameWinnerByTrack(marksByContest.get(contestId) ?? [])
    const soloBonus = soloWinnersByTrack.get(guess.track_id) === guess.submission_id ? SOLO_XP_MULT : 1
    const franchiseMult = kind === 'game' ? 1 : FRANCHISE_XP_MULT

    totalXp += Math.round(baseXp * franchiseMult * soloBonus)
  }

  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(totalXp, seed)

  const gradedCells = contestAgg.totalGame + contestAgg.totalFranchise
  const hpMax = tiltInteger(22 + Math.floor(level * 4 + gradedCells * 0.75), seed, SALT.hp, RESOURCE_SPREAD)
  const mpMax = tiltInteger(14 + Math.floor(level * 3 + gradedCells * 0.5), seed, SALT.mp, RESOURCE_SPREAD)

  return {
    correctGuesses,
    totalXp,
    level,
    xpIntoLevel,
    xpForNextLevel,
    hpCurrent: hpMax,
    hpMax,
    mpCurrent: mpMax,
    mpMax,
    ...combatStatsFromContest(contestAgg, level, totalXp, pn, seed),
  }
}
