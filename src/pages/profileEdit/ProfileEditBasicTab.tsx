import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DisplayNameStyled } from '../../components/DisplayNameStyled'
import {
  normalizeDisplayNameHex,
  parseDisplayNameEffect,
  type DisplayNameStyleCaps,
  type DisplayNameStyleInfo,
} from '../../lib/displayNameStyle'
import type { DisplayNameEffect, Profile } from '../../lib/types'
import { NAME_COLOR_FALLBACK, NAME_EFFECT_OPTIONS } from './shared'

type ProfileEditBasicTabProps = {
  active: boolean
  profile: Profile | null
  avatarPreview: string | null
  avatarBusy: boolean
  username: string
  displayName: string
  bio: string
  nameColor1: string
  nameColor2: string
  nameEffect: DisplayNameEffect
  styleCaps: DisplayNameStyleCaps
  nameStylePreviewInfo: DisplayNameStyleInfo
  submitBusy: boolean
  onUsernameChange: (value: string) => void
  onDisplayNameChange: (value: string) => void
  onBioChange: (value: string) => void
  onNameColor1Change: (value: string) => void
  onNameColor2Change: (value: string) => void
  onNameEffectChange: (value: DisplayNameEffect) => void
  onAvatarFile: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar: () => void
  onSavePublic: (event: FormEvent) => void
}

export function ProfileEditBasicTab({
  active,
  profile,
  avatarPreview,
  avatarBusy,
  username,
  displayName,
  bio,
  nameColor1,
  nameColor2,
  nameEffect,
  styleCaps,
  nameStylePreviewInfo,
  submitBusy,
  onUsernameChange,
  onDisplayNameChange,
  onBioChange,
  onNameColor1Change,
  onNameColor2Change,
  onNameEffectChange,
  onAvatarFile,
  onRemoveAvatar,
  onSavePublic,
}: ProfileEditBasicTabProps) {
  return (
    <div
      id="profile-panel-basic"
      role="tabpanel"
      aria-labelledby="profile-tab-basic"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      <section className="section">
        <h2>Profile picture</h2>
        <p className="muted small">Uploaded files will be resized to 150x150 pixels.</p>
        <div className="profile-edit-avatar-row">
          {avatarPreview ? (
            <img
              key={profile?.avatar_path ?? 'avatar'}
              src={avatarPreview}
              alt=""
              className="profile-avatar-large"
              width={150}
              height={150}
              decoding="async"
            />
          ) : (
            <span className="profile-avatar-large profile-avatar-large--empty" aria-hidden />
          )}
          <div className="profile-edit-avatar-actions">
            <label className="button small primary" style={{ cursor: avatarBusy ? 'wait' : 'pointer' }}>
              {avatarBusy ? 'Working...' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                disabled={avatarBusy || !profile}
                onChange={onAvatarFile}
              />
            </label>
            {profile?.avatar_path ? (
              <button
                type="button"
                className="button small ghost"
                disabled={avatarBusy}
                onClick={() => void onRemoveAvatar()}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Public profile</h2>
        <form className="form" onSubmit={onSavePublic}>
          <label className="field">
            <span>Username (URL: /players/username)</span>
            <input value={username} onChange={(event) => onUsernameChange(event.target.value)} autoComplete="username" />
          </label>

          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} />
          </label>

          <label className="field">
            <span>Bio</span>
            <textarea value={bio} onChange={(event) => onBioChange(event.target.value)} rows={4} />
          </label>

          <h3 className="profile-subhead">Name color</h3>
          <label className="field">
            <div className="row tight profile-edit-name-color-row">
              <input
                type="color"
                aria-label="Pick name color"
                value={normalizeDisplayNameHex(nameColor1 || null) ?? NAME_COLOR_FALLBACK}
                onChange={(event) => onNameColor1Change(event.target.value)}
              />
              <button type="button" className="button small ghost" onClick={() => onNameColor1Change('')}>
                Clear
              </button>
            </div>
            {!nameColor1 && (
              <span className="muted small">
                Uses the default link color until you choose a color.
              </span>
            )}
          </label>

          {styleCaps.canGradient ? (
            <>
              <h3 className="profile-subhead">Second name color</h3>
              <label className="field">
                <div className="row tight profile-edit-name-color-row">
                  <input
                    type="color"
                    aria-label="Pick second name color"
                    value={normalizeDisplayNameHex(nameColor2 || null) ?? NAME_COLOR_FALLBACK}
                    onChange={(event) => onNameColor2Change(event.target.value)}
                  />
                  <button type="button" className="button small ghost" onClick={() => onNameColor2Change('')}>
                    Clear
                  </button>
                </div>
              </label>
            </>
          ) : null}

          {styleCaps.canEffect ? (
            <>
              <h3 className="profile-subhead">Name effect</h3>
              <label className="field">
                <select
                  value={nameEffect}
                  onChange={(event) => onNameEffectChange(parseDisplayNameEffect(event.target.value))}
                >
                  {NAME_EFFECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <p className="profile-subhead">Name preview</p>
          <p className="profile-edit-name-preview">
            <DisplayNameStyled text={displayName.trim() || 'Your display name'} info={nameStylePreviewInfo} />
          </p>

          <button type="submit" className="button primary" disabled={submitBusy}>
            Save profile
          </button>
        </form>
        {profile?.username ? (
          <p>
            <Link to={`/players/${encodeURIComponent(profile.username)}`}>View public profile</Link>
          </p>
        ) : null}
      </section>
    </div>
  )
}
