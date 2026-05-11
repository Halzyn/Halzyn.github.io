import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { invokeContestPublishedNotify } from '../../lib/contestPublishedNotify'
import { getSupabase } from '../../lib/supabase'
import { slugifyUrlSegment } from '../../lib/slugify'
import type { Contest } from '../../lib/types'

export function AdminContests() {
  useDocumentTitle(pageTitle('Admin', 'Contests'))
  const supabase = getSupabase()
  const { userId } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(false)

  const loadContests = useCallback(async () => {
    const { data, error } = await supabase.from('contests').select('*').order('created_at', {
      ascending: false,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    setContests((data ?? []) as Contest[])
    setPageError(null)
  }, [supabase])

  useEffect(() => {
    void loadContests()
  }, [loadContests])

  async function createContest(event: FormEvent) {
    event.preventDefault()
    const contestSlug = slugifyUrlSegment(slug || title)
    if (!contestSlug) {
      setPageError('Need a title or slug.')
      return
    }
    const { data: newContest, error: insertError } = await supabase
      .from('contests')
      .insert({
        slug: contestSlug,
        title: title.trim(),
        description: description.trim() || null,
        deadline: new Date(deadline).toISOString(),
        published,
        results_published: false,
      })
      .select('id')
      .single()

    if (insertError) {
      setPageError(insertError.message)
      return
    }
    if (newContest?.id && userId) {
      const { error: modError } = await supabase.from('contest_moderators').insert({
        contest_id: newContest.id as string,
        user_id: userId,
      })
      if (modError) {
        setPageError(modError.message)
        return
      }
    }
    if (published && newContest?.id) {
      invokeContestPublishedNotify(supabase, newContest.id as string)
    }
    setTitle('')
    setSlug('')
    setDescription('')
    setDeadline('')
    setPublished(false)
    void loadContests()
  }

  return (
    <div className="page">
      <h1>Contests</h1>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

      <section className="section">
        <h2>Create contest</h2>
        <form className="form" onSubmit={createContest}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            <span>URL</span>
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
            <span>Published</span>
          </label>
          <button type="submit" className="button primary">
            Create
          </button>
        </form>
      </section>

      <section className="section">
        <h2>All contests</h2>
        <ul className="card-list">
          {contests.map((contest) => (
            <li key={contest.id} className="card">
              <Link to={`/admin/contests/${contest.id}`}>
                <span className="card-title">{contest.title}</span>
                <span className="muted small">{contest.slug}</span>
                <span className="pill">{contest.published ? 'published' : 'draft'}</span>
                {!contest.published && contest.scheduled_publish_at ? (
                  <span className="pill">scheduled</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
