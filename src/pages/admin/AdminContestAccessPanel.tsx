import type { FormEvent } from 'react'
import { getSupabase } from '../../lib/supabase'
import type { Contest } from '../../lib/types'

type ModeratorRow = { user_id: string; username: string | null }
type GuestHostRow = { id: string; display_name: string; sort_order: number }

type AdminContestAccessPanelProps = {
  moderators: ModeratorRow[]
  guestHosts: GuestHostRow[]
  modUsername: string
  guestHostName: string
  onModUsernameChange: (value: string) => void
  onGuestHostNameChange: (value: string) => void
  onAddModerator: (event: FormEvent) => void
  onRemoveModerator: (userId: string) => void
  onAddGuestHost: (event: FormEvent) => void
  onRemoveGuestHost: (rowId: string) => void
}

export function AdminContestAccessPanel({
  moderators,
  guestHosts,
  modUsername,
  guestHostName,
  onModUsernameChange,
  onGuestHostNameChange,
  onAddModerator,
  onRemoveModerator,
  onAddGuestHost,
  onRemoveGuestHost,
}: AdminContestAccessPanelProps) {
  return (
    <>
      <section className="section">
        <h2>Contest moderators</h2>
        {moderators.length === 0 ? <p className="muted">None yet.</p> : null}
        <ul className="stack">
          {moderators.map((moderator) => (
            <li key={moderator.user_id} className="row spread panel">
              <span>{moderator.username ?? moderator.user_id}</span>
              <button
                type="button"
                className="button ghost small"
                onClick={() => void onRemoveModerator(moderator.user_id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form className="form row-form" onSubmit={onAddModerator}>
          <label className="field">
            <span>Add by username</span>
            <input
              value={modUsername}
              onChange={(e) => onModUsernameChange(e.target.value)}
              placeholder="playername"
            />
          </label>
          <button type="submit" className="button">
            Add
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Guest collaborators</h2>
        <p className="muted small">
          Hosts who don't have an account.
        </p>
        {guestHosts.length === 0 ? <p className="muted">None yet.</p> : null}
        <ul className="stack">
          {guestHosts.map((row) => (
            <li key={row.id} className="row spread panel">
              <span>{row.display_name}</span>
              <button
                type="button"
                className="button ghost small"
                onClick={() => void onRemoveGuestHost(row.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form className="form row-form" onSubmit={onAddGuestHost}>
          <label className="field">
            <span>Add name</span>
            <input
              value={guestHostName}
              onChange={(e) => onGuestHostNameChange(e.target.value)}
              placeholder="Display name"
            />
          </label>
          <button type="submit" className="button">
            Add
          </button>
        </form>
      </section>
    </>
  )
}

export function useContestAccess(
  contest: Contest | null,
  onReload: () => void,
  setPageError: (message: string | null) => void,
) {
  const supabase = getSupabase()

  async function addModerator(e: FormEvent, modUsername: string, clearUsername: () => void) {
    e.preventDefault()
    if (!contest) return
    const normalizedUsername = modUsername.trim()
    if (!normalizedUsername) return
    setPageError(null)
    const { data: profileRow, error: profileLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()
    if (profileLookupError || !profileRow) {
      setPageError('No profile with that username.')
      return
    }
    const { error } = await supabase.from('contest_moderators').insert({
      contest_id: contest.id,
      user_id: (profileRow as { id: string }).id,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    clearUsername()
    onReload()
  }

  async function removeModerator(userId: string) {
    if (!contest) return
    setPageError(null)
    const { error } = await supabase
      .from('contest_moderators')
      .delete()
      .eq('contest_id', contest.id)
      .eq('user_id', userId)
    if (error) {
      setPageError(error.message)
      return
    }
    onReload()
  }

  async function addGuestHost(
    e: FormEvent,
    guestHostName: string,
    guestHosts: GuestHostRow[],
    clearName: () => void,
  ) {
    e.preventDefault()
    if (!contest) return
    const name = guestHostName.trim()
    if (!name) return
    setPageError(null)
    const nextOrder =
      guestHosts.length === 0 ? 0 : Math.max(...guestHosts.map((row) => row.sort_order), -1) + 1
    const { error } = await supabase.from('contest_guest_hosts').insert({
      contest_id: contest.id,
      display_name: name,
      sort_order: nextOrder,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    clearName()
    onReload()
  }

  async function removeGuestHost(rowId: string) {
    if (!contest) return
    setPageError(null)
    const { error } = await supabase
      .from('contest_guest_hosts')
      .delete()
      .eq('id', rowId)
      .eq('contest_id', contest.id)
    if (error) {
      setPageError(error.message)
      return
    }
    onReload()
  }

  return { addModerator, removeModerator, addGuestHost, removeGuestHost }
}
