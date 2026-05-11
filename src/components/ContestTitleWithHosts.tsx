import { Fragment } from 'react'
import { DisplayNameStyled } from './DisplayNameStyled'
import type { ContestHosts } from '../lib/contestHosts'

type Props = {
  title: string
  hosts?: ContestHosts
  titleClassName?: string
}

export function ContestTitleWithHosts({ title, hosts, titleClassName = 'card-title' }: Props) {
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
              <DisplayNameStyled
                text={host.displayName}
                info={host.profileUserId ? hosts.styles.get(host.profileUserId) : undefined}
                className="contest-title-with-hosts-name"
              />
            </Fragment>
          ))
        : null}
    </span>
  )
}
