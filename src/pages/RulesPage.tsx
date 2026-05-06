import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const RULES_BODY =
  "For every song, you have to determine the specific game this song is played in. A good answer will net you 1 point. If you guess the franchise correctly, but you picked the wrong game, you get half a point for trying. If you're the only one to guess a song, you'll get half a bonus point, so exclusive guesses are powerful! Songs are typically divided into 4 categories: easy, medium, hard and joke songs. You're not allowed to discuss your answers with anyone, and you're not allowed to post hints anywhere. It's important that people work for their own answers. There is no penalty for a wrong answer, so even if you're unsure or have no idea at all, it never hurts to try! I won't publish what you send me, only the final results."

const SUBMIT_EDIT_LINK_BODY = `When you submit answers for a contest, you receive a private edit link. Bookmark that page, or store the link somewhere! Only someone with that link can change that entry, so picking a display name that is already taken will be blocked unless you are updating your own entry. If you lose the link before the deadline, contact me on Discord @halzyn.`

const TIEBREAKER_BODY = `In the event of two people getting equal scores, ties are broken using the following rules in set order:
1. Most correct game answers
2. Most solo answers
3. Most correct answers in Insane
4. Most correct answers in Hard
5. Most correct answers in Medium

If all of the above are equal, then the players are truly tied.`

export function RulesPage() {
  useDocumentTitle(pageTitle('Rules'))

  return (
    <div className="page rules-page">
      <h2 className="rules-section-head">RULES</h2>
      <p className="rules-body">{RULES_BODY}</p>

      <h2 className="rules-section-head">SUBMITTING ANSWERS</h2>
      <p className="rules-body">{SUBMIT_EDIT_LINK_BODY}</p>

      <h2 className="rules-section-head">IN THE EVENT OF A TIEBREAKER</h2>
      <p className="rules-body rules-body-pre">{TIEBREAKER_BODY}</p>

      <p className="muted small">
        <Link to="/">Home</Link>
      </p>
    </div>
  )
}
