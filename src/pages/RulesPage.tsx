import { Link } from 'react-router-dom'
import { rulesPageMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'

const GOAL_BODY = `The contest consists of a series of unlabeled video game songs. Your goal is to identify in which specific game the song is played.
The songs are typically divided into 5 categories: easy, medium, hard, insane and joke songs.`

const SCORING_BODY =
  `A correct answer will net you 1 point.
  If you guess the franchise correctly, but you picked the wrong game (or no game at all), you get half a point for trying.
  If you're the only one to guess a song, you'll get half a bonus point, so exclusive guesses are powerful!`

const GUESSING_BODY = `There is no penalty for a wrong guess, so even if you're unsure or have no idea at all, it never hurts to try! I won't publish what you send me, only the final results.
However, make sure your answer only contains one game or franchise, not multiple. I will only count the first game or franchise you mention in your answer. (e.g. if you write "Mario or Zelda", I will only count "Mario")
Your guess does not have to be the original source if the exact same song also appears in a different game. (like with Super Smash Bros. Ultimate, for instance)
Please note that community-based music doesn't count! I know there's Super Mario Galaxy music in osu!, but that doesn't make it a valid guess.`

const SUBMISSION_BODY = `When you submit answers for a contest, you receive a private edit link. Bookmark that page, or store the link somewhere! Only someone with that link can change that entry, so picking a display name that is already taken will be blocked unless you are updating your own entry. If you lose the link before the deadline, contact me on Discord @halzyn.`

const RESEARCH_BODY = `You're not allowed to share your answers with anybody, and you're not allowed to work together.
Don't hint people a certain way either.
You are allowed to look up songs on platforms like YouTube, KHInsider, or your own soundtrack collection. IMO half the fun is discovering songs from the contest when going through soundtracks.
You're not allowed to use any sound search engines like Shazam. Obviously I can't enforce this, but please respect the competitive integrity of the contest. This is supposed to be for fun.`

const TIEBREAKER_BODY = `In the event of two people getting equal scores, ties are broken using the following rules in set order:
1. Most correct game answers
2. Most solo answers
3. Most correct answers in Insane
4. Most correct answers in Hard
5. Most correct answers in Medium

If all of the above are equal, then the players are truly tied.`

export function RulesPage() {
  usePageMeta(rulesPageMeta())

  return (
    <div className="page rules-page">
      <h1 className="rules-section-head">RULES</h1>
      <h2 className="rules-section-head">GOAL</h2>
      <p className="rules-body rules-body-pre">{GOAL_BODY}</p>

      <h2 className="rules-section-head">SCORING</h2>
      <p className="rules-body rules-body-pre">{SCORING_BODY}</p>

      <h2 className="rules-section-head">GUESSING</h2>
      <p className="rules-body rules-body-pre">{GUESSING_BODY}</p>

      <h2 className="rules-section-head">SUBMISSION</h2>
      <p className="rules-body rules-body-pre">{SUBMISSION_BODY}</p>

      <h2 className="rules-section-head">RESEARCH</h2>
      <p className="rules-body rules-body-pre">{RESEARCH_BODY}</p>

      <h2 className="rules-section-head">IN THE EVENT OF A TIEBREAKER</h2>
      <p className="rules-body rules-body-pre">{TIEBREAKER_BODY}</p>

      <p className="muted small">
        <Link to="/">Home</Link>
      </p>
    </div>
  )
}
