import { Link } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState'
import type { MyContestSubmissionRow } from './shared'

type ProfileEditSubmissionsTabProps = {
  active: boolean
  submissionsLoadError: string | null
  mySubmissions: MyContestSubmissionRow[] | null
  openSubmissions: MyContestSubmissionRow[]
  closedSubmissions: MyContestSubmissionRow[]
}

export function ProfileEditSubmissionsTab({
  active,
  submissionsLoadError,
  mySubmissions,
  openSubmissions,
  closedSubmissions,
}: ProfileEditSubmissionsTabProps) {
  return (
    <div
      id="profile-panel-submissions"
      role="tabpanel"
      aria-labelledby="profile-tab-submissions"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      <section className="section">
        <h2>Contest submissions</h2>
        <p className="muted small">
          Entries linked to your account.
        </p>
        {submissionsLoadError ? <p className="banner warn">{submissionsLoadError}</p> : null}
        {mySubmissions === null ? (
          <LoadingState label="Loading submissions..." />
        ) : mySubmissions.length === 0 ? (
          <p className="muted small">No submissions yet. If you've participated in past contests before signing up, you can go to your guest submission links and claim them while signed in. If you lost your link(s), DM me on Discord @halzyn.</p>
        ) : (
          <>
            <h3 className="profile-subhead">Open</h3>
            {openSubmissions.length > 0 ? (
              <ul className="profile-moderation-links">
                {openSubmissions.map((submission) => (
                  <li key={submission.submission_id}>
                    <Link to={`/contests/${encodeURIComponent(submission.contest_slug)}/submit`}>
                      {submission.contest_title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">None</p>
            )}
            <h3 className="profile-subhead">Closed</h3>
            {closedSubmissions.length > 0 ? (
              <ul className="profile-moderation-links">
                {closedSubmissions.map((submission) => (
                  <li key={submission.submission_id}>
                    <Link to={`/contests/${encodeURIComponent(submission.contest_slug)}/submit`}>
                      {submission.contest_title}
                    </Link>
                    <span className="muted small"> View only</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">None</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
