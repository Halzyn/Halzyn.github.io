import type { Track } from '../lib/types'

type Answer = {
  track_id: string
  game_title: string
  franchise: string | null
  notes: string | null
}

type Props = {
  tracks: Track[]
  answers: Answer[]
}

export function SpoilerAnswers({ tracks, answers }: Props) {
  const byId = new Map(answers.map((a) => [a.track_id, a]))

  return (
    <section className="section">
      <h2>Answers</h2>
      <p className="muted small">
        Each row is wrapped in a disclosure so you can avoid spoilers until you are ready.
      </p>
      <ol className="answer-list">
        {tracks.map((t) => {
          const a = byId.get(t.id)
          return (
            <li key={t.id}>
              <details className="spoiler">
                <summary>
                  Track {t.sort_order + 1}
                  {t.difficulty ? ` · ${t.difficulty}` : ''}
                </summary>
                {a ? (
                  <div className="answer-body">
                    <p className="answer-game">{a.game_title}</p>
                    {a.franchise ? <p className="answer-franchise">{a.franchise}</p> : null}
                    {a.notes ? <p className="muted small">{a.notes}</p> : null}
                  </div>
                ) : (
                  <p className="muted">No answer on file yet.</p>
                )}
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
