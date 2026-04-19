import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Contest, Track, TrackAnswer } from '../../lib/types'
import { publicAudioUrl } from '../../lib/audioUrl'

export function AdminContestEdit() {
  const { id } = useParams()
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [answers, setAnswers] = useState<Record<string, TrackAnswer>>({})
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !id) return
    setErr(null)
    const { data: c, error: cErr } = await supabase.from('contests').select('*').eq('id', id).single()
    if (cErr || !c) {
      setErr(cErr?.message ?? 'Not found')
      setContest(null)
      return
    }
    const row = c as Contest
    setContest(row)
    setTitle(row.title)
    setSlug(row.slug)
    setDescription(row.description ?? '')
    setPublished(row.published)
    const d = new Date(row.deadline)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setDeadline(local)

    const { data: tRows } = await supabase
      .from('tracks')
      .select('*')
      .eq('contest_id', id)
      .order('sort_order', { ascending: true })
    const tList = (tRows ?? []) as Track[]
    setTracks(tList)
    const nextOrder = tList.length ? Math.max(...tList.map((x) => x.sort_order)) + 1 : 0
    setSortOrder(nextOrder)

    const ids = tList.map((t) => t.id)
    let ans: TrackAnswer[] = []
    if (ids.length) {
      const { data: aRows } = await supabase.from('track_answers').select('*').in('track_id', ids)
      ans = (aRows ?? []) as TrackAnswer[]
    }
    const map: Record<string, TrackAnswer> = {}
    for (const a of ans) map[a.track_id] = a
    setAnswers(map)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function saveContest(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !contest) return
    const { error } = await supabase
      .from('contests')
      .update({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        deadline: new Date(deadline).toISOString(),
        published,
      })
      .eq('id', contest.id)
    if (error) {
      setErr(error.message)
      return
    }
    void load()
  }

  async function addTrack(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !contest || !file) {
      setErr('Choose an audio file.')
      return
    }
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'mp3'
    const objectPath = `${contest.id}/${crypto.randomUUID()}.${ext}`
    const { error: uErr } = await supabase.storage.from('contest-audio').upload(objectPath, file, {
      contentType: file.type || 'audio/mpeg',
    })
    if (uErr) {
      setErr(uErr.message)
      return
    }
    const { error: iErr } = await supabase.from('tracks').insert({
      contest_id: contest.id,
      sort_order: sortOrder,
      difficulty: difficulty.trim() || null,
      audio_path: objectPath,
    })
    if (iErr) {
      setErr(iErr.message)
      return
    }
    setFile(null)
    setDifficulty('')
    void load()
  }

  async function removeTrack(t: Track) {
    if (!supabase) return
    if (!window.confirm(`Delete track ${t.sort_order + 1}?`)) return
    await supabase.storage.from('contest-audio').remove([t.audio_path])
    const { error } = await supabase.from('tracks').delete().eq('id', t.id)
    if (error) {
      setErr(error.message)
      return
    }
    void load()
  }

  async function saveAnswer(trackId: string, game: string, franchise: string, notes: string) {
    if (!supabase) return
    const { error } = await supabase.from('track_answers').upsert(
      {
        track_id: trackId,
        game_title: game.trim() || 'Unknown',
        franchise: franchise.trim() || null,
        notes: notes.trim() || null,
      },
      { onConflict: 'track_id' },
    )
    if (error) {
      setErr(error.message)
      return
    }
    void load()
  }

  if (!id) return null
  if (err && !contest) return <p className="banner warn">{err}</p>
  if (!contest) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <p>
        <Link to="/admin/contests">← Contests</Link>
      </p>
      <h1>Edit contest</h1>
      {err ? <p className="banner warn">{err}</p> : null}

      <form className="form" onSubmit={saveContest}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span>Slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </label>
        <label className="field">
          <span>Deadline</span>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className="field row">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>Published</span>
        </label>
        <button type="submit" className="button primary">
          Save contest
        </button>
      </form>

      <p>
        <Link className="button" to={`/admin/contests/${contest.id}/grade`}>
          Grade submissions
        </Link>
        <Link className="button ghost" to={`/contests/${contest.slug}`}>
          Public page
        </Link>
      </p>

      <section className="section">
        <h2>Upload track</h2>
        <form className="form" onSubmit={addTrack}>
          <label className="field">
            <span>Sort order (0 = first)</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
            />
          </label>
          <label className="field">
            <span>Difficulty label</span>
            <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Easy / Hard…" />
          </label>
          <label className="field">
            <span>Audio file</span>
            <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" className="button primary">
            Upload track
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Tracks & answers</h2>
        {tracks.length === 0 ? <p className="muted">No tracks yet.</p> : null}
        <ul className="stack">
          {tracks.map((t) => {
            const a = answers[t.id]
            const href = publicAudioUrl(t.audio_path)
            return (
              <li key={t.id} className="panel">
                <div className="row spread">
                  <strong>
                    #{t.sort_order} {t.difficulty ? `· ${t.difficulty}` : ''}
                  </strong>
                  <button type="button" className="button ghost small" onClick={() => void removeTrack(t)}>
                    Delete
                  </button>
                </div>
                {href ? (
                  <audio className="player" controls src={href} preload="metadata" />
                ) : null}
                <AnswerForm key={t.id} initial={a} onSave={(g, f, n) => void saveAnswer(t.id, g, f, n)} />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function AnswerForm({
  initial,
  onSave,
}: {
  initial?: TrackAnswer
  onSave: (game: string, franchise: string, notes: string) => void
}) {
  const [game, setGame] = useState(() => initial?.game_title ?? '')
  const [franchise, setFranchise] = useState(() => initial?.franchise ?? '')
  const [notes, setNotes] = useState(() => initial?.notes ?? '')

  return (
    <form
      className="form tight"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(game, franchise, notes)
      }}
    >
      <label className="field">
        <span>Answer — game title</span>
        <input value={game} onChange={(e) => setGame(e.target.value)} required />
      </label>
      <label className="field">
        <span>Franchise (optional)</span>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} />
      </label>
      <label className="field">
        <span>Notes (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button type="submit" className="button small">
        Save answer
      </button>
    </form>
  )
}
