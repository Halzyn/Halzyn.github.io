import { Link } from 'react-router-dom'
import type { Profile } from '../../lib/types'

type ModeratedContest = { id: string; slug: string; title: string }

type ProfileEditModerationTabProps = {
  active: boolean
  profile: Profile | null
  moderatedContests: ModeratedContest[]
}

export function ProfileEditModerationTab({
  active,
  profile,
  moderatedContests,
}: ProfileEditModerationTabProps) {
  return (
    <div
      id="profile-panel-moderation"
      role="tabpanel"
      aria-labelledby="profile-tab-moderation"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      {profile?.is_admin ? (
        <section className="section">
          <h2>Site administration</h2>
          <p className="muted small">
            Manage contests, the games catalog, and registered accounts.
          </p>
          <ul className="profile-moderation-links">
            <li>
              <Link to="/admin/contests">Contests</Link>
            </li>
            <li>
              <Link to="/admin/games">Games</Link>
            </li>
            <li>
              <Link to="/admin/users">Users</Link>
            </li>
          </ul>
        </section>
      ) : (
        <section className="section">
          <h2>Contests you moderate</h2>
          <p className="muted small">
            Open a contest to edit tracks and metadata, or open grading to score submissions.
          </p>
          <ul className="profile-moderation-links">
            {moderatedContests.map((contest) => (
              <li key={contest.id}>
                <Link to={`/admin/contests/${contest.id}`}>{contest.title}</Link>{' '}
                <Link to={`/admin/contests/${contest.id}/grade`} className="muted small">
                  Grade
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
