import { Fragment } from 'react'
import { ContestHostName } from './ContestHostName'
import type { ContestHosts } from '../lib/contestHosts'

type Props = {
  title: string
  hosts?: ContestHosts
  titleClassName?: string
  hostsNestedInLink?: boolean
}

export function ContestTitleWithHosts({
  title,
  hosts,
  titleClassName = 'card-title',
  hostsNestedInLink = false,
}: Props) {
  const hasHosts = Boolean(hosts?.entries.length)
  return (
    <span className="contest-title-with-hosts">
      <span className={titleClassName}>{title}</span>
      {hasHosts && hosts
        ? hosts.entries.map((host) => (
            <Fragment key={host.hostKey}>
              <span className="contest-title-with-hosts-sep" aria-hidden>
                ·
              </span>
              <ContestHostName
                displayName={host.displayName}
                profileUsername={host.profileUsername}
                styleInfo={host.profileUserId ? hosts.styles.get(host.profileUserId) : undefined}
                className="contest-title-with-hosts-name"
                nestedInLink={hostsNestedInLink}
              />
            </Fragment>
          ))
        : null}
    </span>
  )
}
