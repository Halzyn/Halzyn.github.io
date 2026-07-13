import type { Game, Profile } from '../../lib/types'

type ProfileEditFunTabProps = {
  active: boolean
  profile: Profile | null
  gamesLoadError: string | null
  gamesLoading: boolean
  games: Game[]
  gameSearch: string
  favoriteGameId: string | null
  selectedGame: Game | null
  filteredGames: Game[]
  favoriteBusy: boolean
  onGameSearchChange: (value: string) => void
  onFavoriteGameIdChange: (value: string | null) => void
  onSaveFavorite: () => void
}

export function ProfileEditFunTab({
  active,
  profile,
  gamesLoadError,
  gamesLoading,
  games,
  gameSearch,
  favoriteGameId,
  selectedGame,
  filteredGames,
  favoriteBusy,
  onGameSearchChange,
  onFavoriteGameIdChange,
  onSaveFavorite,
}: ProfileEditFunTabProps) {
  return (
    <div
      id="profile-panel-fun"
      role="tabpanel"
      aria-labelledby="profile-tab-fun"
      hidden={!active}
      className="profile-edit-tab-panel"
    >
      <section className="section">
        <h2>Favorite soundtrack</h2>
        <p className="muted small">
          This will appear on your profile page.
        </p>
        {gamesLoadError ? <p className="banner warn">{gamesLoadError}</p> : null}
        {gamesLoading ? (
          <p className="muted">Loading games...</p>
        ) : (
          <>
            <label className="field">
              <span>Search games</span>
              <input
                value={gameSearch}
                onChange={(event) => onGameSearchChange(event.target.value)}
                placeholder="Type to filter..."
                autoComplete="off"
              />
            </label>
            {favoriteGameId && !selectedGame ? (
              <p className="muted small">
                Something went wrong with your saved game. Pick another one, I guess.
              </p>
            ) : selectedGame ? (
              <div className="profile-edit-favorite-picked">
                {selectedGame.cover_image_url ? (
                  <img
                    src={selectedGame.cover_image_url}
                    alt=""
                    className="profile-edit-favorite-thumb"
                    width={64}
                    height={64}
                    decoding="async"
                  />
                ) : (
                  <span className="profile-edit-favorite-thumb profile-edit-favorite-thumb--empty" aria-hidden />
                )}
                <span className="profile-edit-favorite-title">{selectedGame.primary_title}</span>
              </div>
            ) : (
              <p className="muted small">No game selected.</p>
            )}
            <ul className="profile-edit-game-list" aria-label="Choose a game">
              {filteredGames.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    className={
                      'profile-edit-game-option' +
                      (favoriteGameId === game.id ? ' profile-edit-game-option--selected' : '')
                    }
                    onClick={() => onFavoriteGameIdChange(game.id)}
                  >
                    {game.primary_title}
                  </button>
                </li>
              ))}
            </ul>
            {filteredGames.length === 0 && games.length > 0 ? (
              <p className="muted small">No games match your search.</p>
            ) : null}
            {games.length === 0 && !gamesLoadError ? (
              <p className="muted small">Loading games...</p>
            ) : null}
            <div className="row tight" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="button primary"
                disabled={favoriteBusy || !profile}
                onClick={() => void onSaveFavorite()}
              >
                Save favorite
              </button>
              <button
                type="button"
                className="button ghost"
                disabled={favoriteBusy}
                onClick={() => onFavoriteGameIdChange(null)}
              >
                Clear selection
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
