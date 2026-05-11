import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabase } from '../../lib/supabase'
import type { Submission } from '../../lib/types'

type AdminContestSubmissionsProps = {
  contestId: string
  contestSlug: string
  submissions: Submission[]
  onReload: () => void
  onError: (msg: string | null) => void
}

function isAwaitingReview(submission: Submission): boolean {
  return (submission.review_status ?? 'open') !== 'reviewed'
}

function mergeSubmissionOptions(submissions: Submission[]) {
  return submissions.map((submission) => (
    <option key={submission.id} value={submission.id}>
      {submission.contestant_name} ({submission.review_status ?? 'open'})
    </option>
  ))
}

export function AdminContestSubmissions({
  contestId,
  contestSlug,
  submissions,
  onReload,
  onError,
}: AdminContestSubmissionsProps) {
  const supabase = getSupabase()
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [mergeKeepId, setMergeKeepId] = useState('')
  const [mergeRemoveId, setMergeRemoveId] = useState('')
  const [mergeBusy, setMergeBusy] = useState(false)
  const [resetLinkBusyId, setResetLinkBusyId] = useState<string | null>(null)
  const [resetLinkBanner, setResetLinkBanner] = useState<{
    name: string
    absoluteUrl: string
    path: string
  } | null>(null)

  const draftName = useCallback(
    (submission: Submission) => nameDrafts[submission.id] ?? submission.contestant_name,
    [nameDrafts],
  )

  async function saveName(submission: Submission) {
    const nextName = (nameDrafts[submission.id] ?? submission.contestant_name).trim()
    if (nextName.length < 1 || nextName.length > 80) {
      onError('Name must be 1–80 characters.')
      return
    }
    onError(null)
    const { error } = await supabase
      .from('submissions')
      .update({ contestant_name: nextName, updated_at: new Date().toISOString() })
      .eq('id', submission.id)
    if (error) {
      onError(error.message)
      return
    }
    setNameDrafts((drafts) => {
      const next = { ...drafts }
      delete next[submission.id]
      return next
    })
    onReload()
  }

  async function setReviewStatus(submissionId: string, status: 'open' | 'reviewed') {
    onError(null)
    const { error } = await supabase
      .from('submissions')
      .update({ review_status: status, updated_at: new Date().toISOString() })
      .eq('id', submissionId)
    if (error) {
      onError(error.message)
      return
    }
    onReload()
  }

  async function mergeSubmissions() {
    if (!mergeKeepId || !mergeRemoveId || mergeKeepId === mergeRemoveId) {
      onError('Choose two different submissions: one to keep and one to merge away.')
      return
    }
    if (!window.confirm('Merge the “merge away” entry into the kept entry? The second row will be deleted.')) {
      return
    }
    onError(null)
    setMergeBusy(true)
    const { error } = await supabase.rpc('admin_merge_submissions', {
      p_target_id: mergeKeepId,
      p_source_id: mergeRemoveId,
    })
    setMergeBusy(false)
    if (error) {
      onError(error.message)
      return
    }
    setMergeRemoveId('')
    onReload()
  }

  async function resetEditLink(submission: Submission) {
    if (
      !window.confirm(
        `Generate a new private edit link for “${submission.contestant_name}”? Their previous link will stop working immediately.`,
      )
    ) {
      return
    }
    onError(null)
    setResetLinkBanner(null)
    setResetLinkBusyId(submission.id)
    const { data, error } = await supabase.rpc('admin_reset_submission_edit_token', {
      p_submission_id: submission.id,
    })
    setResetLinkBusyId(null)
    if (error) {
      onError(error.message)
      return
    }
    const path = (data as { submit_path?: string } | null)?.submit_path ?? ''
    const absoluteUrl = path.startsWith('http') ? path : `${window.location.origin}${path}`
    setResetLinkBanner({
      name: submission.contestant_name,
      absoluteUrl,
      path,
    })
    onReload()
  }

  return (
    <section className="section">
      <h2>Submissions</h2>
      <p className="muted small admin-contest-submissions-lede">
        {`Open the grid to start grading a submission. When submissions are ready to be reviewed, they will be marked as Open.
          When you're done reviewing, click Done to mark the submission as reviewed. If someone edits their submission, the status will be reset to Open.
          You can press Open submit to view a user's actual submission answers.
          You can reset someone's edit link by clicking "New edit link". This is helpful if someone loses their link.
          You can edit a submission's name by editing it below and clicking "Save name". This is for moderation purposes only, DO NOT use unless necessary.
          You can merge two submissions by selecting one to keep and one to merge away. The second submission will be deleted and the grades will be copied to the first submission.
          This is useful if someone accidentally submitted twice with different names.`}
      </p>

      {resetLinkBanner ? (
        <div className="banner success admin-reset-link-banner" role="status">
          <p>
            New edit link for {resetLinkBanner.name}. Send this URL to them, as the old
            link no longer works:
          </p>
          <p className="admin-reset-link-url">
            <code>{resetLinkBanner.absoluteUrl}</code>
          </p>
          <div className="row tight">
            <button
              type="button"
              className="button small"
              onClick={() => void navigator.clipboard.writeText(resetLinkBanner.absoluteUrl)}
            >
              Copy link
            </button>
            <button type="button" className="button ghost small" onClick={() => setResetLinkBanner(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {submissions.length === 0 ? (
        <p className="muted">No submissions yet.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table dense">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Review</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const draft = draftName(submission)
                  const saveDisabled = draft.trim() === submission.contestant_name.trim()
                  const updatedAt = submission.updated_at ?? submission.created_at
                  return (
                    <tr key={submission.id}>
                      <td>
                        <div className="admin-sub-name-row">
                          <input
                            className="admin-sub-name-input"
                            value={draft}
                            onChange={(e) =>
                              setNameDrafts((drafts) => ({
                                ...drafts,
                                [submission.id]: e.target.value,
                              }))
                            }
                            maxLength={80}
                          />
                          <button
                            type="button"
                            className="button small"
                            onClick={() => void saveName(submission)}
                            disabled={saveDisabled}
                          >
                            Save name
                          </button>
                        </div>
                      </td>
                      <td>{isAwaitingReview(submission) ? 'Open' : 'Reviewed'}</td>
                      <td className="muted small">{new Date(updatedAt).toLocaleString()}</td>
                      <td>
                        <div className="row tight">
                          <Link className="button small" to={`/admin/contests/${contestId}/grade`}>
                            Grid
                          </Link>
                          <Link
                            className="button small"
                            to={`/contests/${contestSlug}/submit?admin_submission=${encodeURIComponent(submission.id)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open submit
                          </Link>
                          {isAwaitingReview(submission) ? (
                            <button
                              type="button"
                              className="button small primary"
                              onClick={() => void setReviewStatus(submission.id, 'reviewed')}
                            >
                              Done
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button small ghost"
                              onClick={() => void setReviewStatus(submission.id, 'open')}
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            type="button"
                            className="button small ghost"
                            disabled={resetLinkBusyId === submission.id}
                            onClick={() => void resetEditLink(submission)}
                          >
                            {resetLinkBusyId === submission.id ? '...' : 'New edit link'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="site-inset admin-merge-panel">
            <h3 className="site-inset-head">Merge two submissions</h3>
            <div className="site-inset-body">
              <div className="form row-form admin-merge-form">
                <label className="field grow">
                  <span>Keep</span>
                  <select
                    value={mergeKeepId}
                    onChange={(e) => setMergeKeepId(e.target.value)}
                    aria-label="Submission to keep"
                  >
                    <option value="">Select...</option>
                    {mergeSubmissionOptions(submissions)}
                  </select>
                </label>
                <label className="field grow">
                  <span>Merge away</span>
                  <select
                    value={mergeRemoveId}
                    onChange={(e) => setMergeRemoveId(e.target.value)}
                    aria-label="Submission to remove after merge"
                  >
                    <option value="">Select...</option>
                    {mergeSubmissionOptions(submissions)}
                  </select>
                </label>
                <button type="button" className="button" disabled={mergeBusy} onClick={() => void mergeSubmissions()}>
                  {mergeBusy ? 'Merging...' : 'Merge'}
                </button>
              </div>
            </div>
          </div>

          <p className="muted small">
            Public contest: <Link to={`/contests/${contestSlug}/submit`}>/contests/{contestSlug}/submit</Link>
          </p>
        </>
      )}
    </section>
  )
}
