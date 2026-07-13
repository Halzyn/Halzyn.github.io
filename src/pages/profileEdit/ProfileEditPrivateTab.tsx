import type { FormEvent } from 'react'
import type { Profile } from '../../lib/types'

type ProfileEditPrivateTabProps = {
  active: boolean
  profile: Profile | null
  email: string
  newPassword: string
  passwordConfirm: string
  notifyNewContestEmail: boolean
  submitBusy: boolean
  notifyEmailBusy: boolean
  onEmailChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onPasswordConfirmChange: (value: string) => void
  onSaveEmail: (event: FormEvent) => void
  onSavePassword: (event: FormEvent) => void
  onNotifyNewContestEmailChange: (enabled: boolean) => void
}

export function ProfileEditPrivateTab({
  active,
  profile,
  email,
  newPassword,
  passwordConfirm,
  notifyNewContestEmail,
  submitBusy,
  notifyEmailBusy,
  onEmailChange,
  onNewPasswordChange,
  onPasswordConfirmChange,
  onSaveEmail,
  onSavePassword,
  onNotifyNewContestEmailChange,
}: ProfileEditPrivateTabProps) {
  return (
    <div
      id="profile-panel-private"
      role="tabpanel"
      aria-labelledby="profile-tab-private"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      <section className="section">
        <h2>Email</h2>
        <form className="form" onSubmit={onSaveEmail}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
            />
          </label>
          <button type="submit" className="button primary" disabled={submitBusy}>
            Update email
          </button>
        </form>

        <p className="profile-subhead">Email notifications</p>
        <label className="field row">
          <input
            type="checkbox"
            checked={notifyNewContestEmail}
            disabled={notifyEmailBusy || !profile}
            onChange={(event) => void onNotifyNewContestEmailChange(event.target.checked)}
          />
          <span>Email me when a new contest goes live</span>
        </label>
      </section>

      <section className="section">
        <h2>Password</h2>
        <form className="form" onSubmit={onSavePassword}>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirm</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => onPasswordConfirmChange(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="button primary" disabled={submitBusy}>
            Change password
          </button>
        </form>
      </section>
    </div>
  )
}
