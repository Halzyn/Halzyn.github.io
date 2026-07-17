import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game, Track, TrackAnswer } from '../../lib/types'
import { useToast } from '../../toast/ToastContext'

export type TrackChooserOption = {
  hostKey: string
  label: string
}

type AnswerFormProps = {
  track: Track
  initial?: TrackAnswer
  gamesCatalog: Game[]
  isAdminUser: boolean
  chooserOptions?: TrackChooserOption[]
  onSave: (
    sortOrderInput: string,
    difficultyDraft: string,
    primaryTitle: string,
    sharedLines: string[],
    song: string,
    notes: string,
    chosenByHostKey: string | null,
  ) => Promise<boolean>
}

export function AdminAnswerForm({
  track,
  initial,
  gamesCatalog,
  isAdminUser,
  chooserOptions,
  onSave,
}: AnswerFormProps) {
  const listId = `game-datalist-${initial?.track_id ?? track.id}`
  const { success: toastSuccess } = useToast()
  const [sortOrderDraft, setSortOrderDraft] = useState(() => String(track.sort_order))
  const [difficultyDraft, setDifficultyDraft] = useState(() => track.difficulty ?? '')
  const [chosenByHostKey, setChosenByHostKey] = useState(() => track.chosen_by_host_key ?? '')
  const [primaryTitle, setPrimaryTitle] = useState(() => (initial?.game_names ?? [])[0] ?? '')
  const [sharedText, setSharedText] = useState(() => (initial?.shared_music_titles ?? []).join('\n'))
  const [song, setSong] = useState(() => initial?.song_title ?? '')
  const [notes, setNotes] = useState(() => initial?.notes ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving'>('idle')
  const showChooser = (chooserOptions?.length ?? 0) > 1

  useEffect(() => {
    setSortOrderDraft(String(track.sort_order))
    setDifficultyDraft(track.difficulty ?? '')
    setChosenByHostKey(track.chosen_by_host_key ?? '')
  }, [track.id, track.sort_order, track.difficulty, track.chosen_by_host_key])

  useEffect(() => {
    setPrimaryTitle((initial?.game_names ?? [])[0] ?? '')
    setSharedText((initial?.shared_music_titles ?? []).join('\n'))
    setSong(initial?.song_title ?? '')
    setNotes(initial?.notes ?? '')
  }, [initial?.track_id, initial?.game_names, initial?.song_title, initial?.notes, initial?.shared_music_titles])

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
            showChooser
              ? chosenByHostKey.trim() || null
              : chooserOptions?.length === 1
                ? chooserOptions[0]!.hostKey
                : null,
          )
          if (!ok) {
            setSaveStatus('idle')
            return
          }
          setSaveStatus('idle')
          toastSuccess('Saved.')
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
            onChange={(e) => setSortOrderDraft(e.target.value)}
            className="track-order-input"
          />
        </label>
        <label className="field row tight">
          <span className="muted">Difficulty</span>
          <input
            value={difficultyDraft}
            onChange={(e) => setDifficultyDraft(e.target.value)}
            placeholder="Easy / Medium / etc."
            className="difficulty-input"
          />
        </label>
      </div>
      {showChooser ? (
        <label className="field">
          <span>Chosen by</span>
          <select value={chosenByHostKey} onChange={(e) => setChosenByHostKey(e.target.value)}>
            <option value="">Select host...</option>
            {chooserOptions!.map((option) => (
              <option key={option.hostKey} value={option.hostKey}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
          onChange={(e) => setPrimaryTitle(e.target.value)}
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
          onChange={(e) => setSharedText(e.target.value)}
          rows={3}
          placeholder={'List each game title on its own line'}
        />
      </label>
      <label className="field">
        <span>Song title</span>
        <input value={song} onChange={(e) => setSong(e.target.value)} />
      </label>
      <label className="field">
        <span>Personal notes</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="row tight save-answer-actions">
        <button type="submit" className="button small" disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? 'Saving...' : 'Save answer'}
        </button>
      </div>
    </form>
  )
}
