import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game, Track, TrackAnswer } from '../../lib/types'

type AnswerFormProps = {
  track: Track
  initial?: TrackAnswer
  gamesCatalog: Game[]
  isAdminUser: boolean
  onSave: (
    sortOrderInput: string,
    difficultyDraft: string,
    primaryTitle: string,
    sharedLines: string[],
    song: string,
    notes: string,
  ) => Promise<boolean>
}

export function AdminAnswerForm({
  track,
  initial,
  gamesCatalog,
  isAdminUser,
  onSave,
}: AnswerFormProps) {
  const listId = `game-datalist-${initial?.track_id ?? track.id}`
  const [sortOrderDraft, setSortOrderDraft] = useState(() => String(track.sort_order))
  const [difficultyDraft, setDifficultyDraft] = useState(() => track.difficulty ?? '')
  const [primaryTitle, setPrimaryTitle] = useState(() => (initial?.game_names ?? [])[0] ?? '')
  const [sharedText, setSharedText] = useState(() => (initial?.shared_music_titles ?? []).join('\n'))
  const [song, setSong] = useState(() => initial?.song_title ?? '')
  const [notes, setNotes] = useState(() => initial?.notes ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    setSortOrderDraft(String(track.sort_order))
    setDifficultyDraft(track.difficulty ?? '')
  }, [track.id, track.sort_order, track.difficulty])

  useEffect(() => {
    setPrimaryTitle((initial?.game_names ?? [])[0] ?? '')
    setSharedText((initial?.shared_music_titles ?? []).join('\n'))
    setSong(initial?.song_title ?? '')
    setNotes(initial?.notes ?? '')
  }, [initial?.track_id, initial?.game_names, initial?.song_title, initial?.notes, initial?.shared_music_titles])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current)
    }
  }, [])

  function bumpSavedTimer() {
    if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
    }, 2200)
  }

  function clearSavedOnEdit() {
    setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
  }

  return (
    <form
      className="form tight"
      onSubmit={(e) => {
        e.preventDefault()
        const sharedMusicLines = sharedText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        void (async () => {
          setSaveStatus('saving')
          const ok = await onSave(
            sortOrderDraft,
            difficultyDraft,
            primaryTitle.trim(),
            sharedMusicLines,
            song,
            notes,
          )
          if (!ok) {
            setSaveStatus('idle')
            return
          }
          setSaveStatus('saved')
          bumpSavedTimer()
        })()
      }}
    >
      <div className="track-order-row">
        <label className="field row tight">
          <span className="muted">Track #</span>
          <input
            type="number"
            min={1}
            step={1}
            value={sortOrderDraft}
            onChange={(e) => {
              clearSavedOnEdit()
              setSortOrderDraft(e.target.value)
            }}
            className="track-order-input"
          />
        </label>
        <label className="field row tight">
          <span className="muted">Difficulty</span>
          <input
            value={difficultyDraft}
            onChange={(e) => {
              clearSavedOnEdit()
              setDifficultyDraft(e.target.value)
            }}
            placeholder="Easy / Medium / etc."
            className="difficulty-input"
          />
        </label>
      </div>
      <datalist id={listId}>
        {gamesCatalog.map((game) => (
          <option key={game.id} value={game.primary_title} />
        ))}
      </datalist>
      <label className="field">
        <span>Game title</span>
        <input
          list={listId}
          value={primaryTitle}
          onChange={(e) => {
            clearSavedOnEdit()
            setPrimaryTitle(e.target.value)
          }}
          maxLength={300}
          required
          placeholder="e.g. Super Mario Bros."
        />
      </label>
      {isAdminUser && initial?.primary_game_id ? (
        <p className="muted small">
          <Link to={`/admin/games/${initial.primary_game_id}`}>Edit alternate titles for this game...</Link>
        </p>
      ) : null}
      <label className="field">
        <span>Other games with the same music</span>
        <textarea
          value={sharedText}
          onChange={(e) => {
            clearSavedOnEdit()
            setSharedText(e.target.value)
          }}
          rows={3}
          placeholder={'List each game title on its own line'}
        />
      </label>
      <label className="field">
        <span>Song title</span>
        <input
          value={song}
          onChange={(e) => {
            clearSavedOnEdit()
            setSong(e.target.value)
          }}
        />
      </label>
      <label className="field">
        <span>Personal notes</span>
        <input
          value={notes}
          onChange={(e) => {
            clearSavedOnEdit()
            setNotes(e.target.value)
          }}
        />
      </label>
      <div className="row tight save-answer-actions">
        <button
          type="submit"
          className={`button small${saveStatus === 'saved' ? ' button-saved-ok' : ''}`}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save answer'}
        </button>
        {saveStatus === 'saved' ? (
          <span className="save-answer-hint" role="status">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  )
}
