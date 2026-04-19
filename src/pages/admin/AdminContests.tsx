import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Contest } from '../../lib/types'

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function AdminContests() {
  const [rows, setRows] = useState<Contest[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(false)

  async function refresh() {
    if (!supabase) return
    const { data, error } = await supabase.from('contests').select('*').order('created_at', {
      ascending: false,
    })
    if (error) {
      setErr(error.message)
      return
    }
    setRows((data ?? []) as Contest[])
    setErr(null)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function createContest(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const sl = slugify(slug.trim() || title)
    if (!sl) {
      setErr('Need a title or slug.')
      return
    }
    const { error } = await supabase.from('contests').insert({
      slug: sl,
      title: title.trim(),
      description: description.trim() || null,
      deadline: new Date(deadline).toISOString(),
      published,
    })
    if (error) {
      setErr(error.message)
      return
    }
    setTitle('')
    setSlug('')
    setDescription('')
    setDeadline('')
    setPublished(false)
    void refresh()
  }

  return (
    <div className="page">
      <h1>Contests</h1>
      {err ? <p className="banner warn">{err}</p> : null}

      <section className="section">
        <h2>Create contest</h2>
        <form className="form" onSubmit={createContest}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            <span>Slug (URL)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto from title"
            />
          </label>
          <label className="field">
            <span>Deadline (local)</span>
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
            <span>Published (visible on public site)</span>
          </label>
          <button type="submit" className="button primary">
            Create
          </button>
        </form>
      </section>

      <section className="section">
        <h2>All contests</h2>
        <ul className="card-list">
          {rows.map((c) => (
            <li key={c.id} className="card">
              <Link to={`/admin/contests/${c.id}`}>
                <span className="card-title">{c.title}</span>
                <span className="muted small">{c.slug}</span>
                <span className="pill">{c.published ? 'published' : 'draft'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
