import { parseSiteBackgroundPattern } from '../../theme/siteBackground'
import type { Profile, SiteBackgroundPattern } from '../../lib/types'
import { SITE_BACKGROUND_OPTIONS } from './shared'

type ProfileEditAppearanceTabProps = {
  active: boolean
  profile: Profile | null
  alwaysRevealSpoilers: boolean
  siteBackgroundPattern: SiteBackgroundPattern
  behaviorBusy: boolean
  appearanceBusy: boolean
  onAlwaysRevealSpoilersChange: (value: boolean) => void
  onSiteBackgroundPatternChange: (value: SiteBackgroundPattern) => void
  onSaveBehavior: () => void
  onSaveAppearance: () => void
}

export function ProfileEditAppearanceTab({
  active,
  profile,
  alwaysRevealSpoilers,
  siteBackgroundPattern,
  behaviorBusy,
  appearanceBusy,
  onAlwaysRevealSpoilersChange,
  onSiteBackgroundPatternChange,
  onSaveBehavior,
  onSaveAppearance,
}: ProfileEditAppearanceTabProps) {
  return (
    <div
      id="profile-panel-appearance"
      role="tabpanel"
      aria-labelledby="profile-tab-appearance"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      <section className="section">
        <h2 id="profile-site-settings-behavior-heading">Behavior</h2>
        <label className="field row">
          <input
            type="checkbox"
            checked={alwaysRevealSpoilers}
            disabled={behaviorBusy || !profile}
            onChange={(event) => onAlwaysRevealSpoilersChange(event.target.checked)}
          />
          <span>Always reveal spoilers</span>
        </label>
        <button
          type="button"
          className="button primary profile-edit-appearance-save"
          disabled={behaviorBusy || !profile}
          onClick={() => void onSaveBehavior()}
        >
          Save behavior
        </button>
      </section>

      <section className="section">
        <h2 id="profile-appearance-bg-heading">Theme</h2>
        <label className="field">
          <span>Background</span>
          <select
            id="profile-appearance-bg-select"
            value={siteBackgroundPattern}
            disabled={!profile || appearanceBusy}
            onChange={(event) =>
              onSiteBackgroundPatternChange(parseSiteBackgroundPattern(event.target.value))
            }
          >
            <option value="none">No background</option>
            {SITE_BACKGROUND_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button primary profile-edit-appearance-save"
          disabled={appearanceBusy || !profile}
          onClick={() => void onSaveAppearance()}
        >
          Save theme
        </button>
      </section>
    </div>
  )
}
