import { Link } from 'react-router-dom'
import { ContestCalendarLink } from './ContestCalendarLink'
import { ContestTitleWithHosts } from './ContestTitleWithHosts'
import type { ContestHosts } from '../lib/contestHosts'
import { contestClosed } from '../lib/deadline'
import { prefetchContestCore, prefetchOnIntent } from '../lib/queryPrefetch'

type ContestCardProps = {
  slug: string
  contestId: string
  title: string
  deadline: string
  hosts?: ContestHosts
  hostsNestedInLink?: boolean
  status?: 'open' | 'closed'
  showStatusPill?: boolean
}

export function ContestCard({
  slug,
  contestId,
  title,
  deadline,
  hosts,
  hostsNestedInLink = true,
  status,
  showStatusPill = false,
}: ContestCardProps) {
  const open =
    status === 'open' ? true : status === 'closed' ? false : !contestClosed(deadline)
  const deadlinePrefix = open ? 'Deadline' : 'Concluded'

  return (
    <li className="card">
      <Link
        to={`/contests/${slug}`}
        {...prefetchOnIntent(() => prefetchContestCore(slug))}
      >
        {showStatusPill ? (
          <span className="contest-card-head">
            <ContestTitleWithHosts
              title={title}
              hosts={hosts}
              hostsNestedInLink={hostsNestedInLink}
            />
            <span className="pill">{open ? 'Open' : 'Closed'}</span>
          </span>
        ) : (
          <ContestTitleWithHosts
            title={title}
            hosts={hosts}
            hostsNestedInLink={hostsNestedInLink}
          />
        )}
        <span className="muted small contest-card-deadline">
          {deadlinePrefix} {new Date(deadline).toLocaleString()}
          {open ? (
            <>
              {' ◦ '}
              <ContestCalendarLink
                contestId={contestId}
                contestSlug={slug}
                contestTitle={title}
                deadlineIso={deadline}
                events={['deadline']}
              />
            </>
          ) : null}
        </span>
      </Link>
    </li>
  )
}
