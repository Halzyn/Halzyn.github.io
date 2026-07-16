import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '../../lib/supabase'
import type { Game, GameAlternateTitle, IgdbGamePreview } from '../../lib/types'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { slugifyGameTitle } from '../../lib/slugify'
import { queryKeys } from '../../lib/queries/keys'
import { useAdminGameEdit } from '../../hooks/useAdminQueries'
import { LoadingState } from '../../components/LoadingState'

function IgdbRow({
  label,
  children,
  ddClassName,
}: {
  label: string
  children: ReactNode
  ddClassName?: string
}) {
  if (children == null || children === '') return null
  return (
    <>
      <dt>{label}</dt>
      <dd className={ddClassName}>{children}</dd>
    </>
  )
}

function IgdbPreviewDetails({ preview }: { preview: IgdbGamePreview }) {
  return (
    <dl className="admin-igdb-dl">
      <IgdbRow label="IGDB id">{preview.igdb_id}</IgdbRow>
      <IgdbRow label="IGDB name">{preview.igdb_name}</IgdbRow>
      <IgdbRow label="Release">{preview.release_date}</IgdbRow>
      <IgdbRow label="Genres">
        {preview.genres.length > 0 ? preview.genres.join(', ') : null}
      </IgdbRow>
      <IgdbRow label="Platforms">
        {preview.platforms.length > 0 ? preview.platforms.join(', ') : null}
      </IgdbRow>
      <IgdbRow label="Cover URL">
        {preview.cover_image_url ? (
          <a href={preview.cover_image_url} target="_blank" rel="noreferrer">
            {preview.cover_image_url}
          </a>
        ) : null}
      </IgdbRow>
      <IgdbRow label="Description" ddClassName="admin-igdb-desc">
        {preview.description}
      </IgdbRow>
    </dl>
  )
}

function SavedCatalogDetails({ game }: { game: Game }) {
  const hasAny =
    game.igdb_id != null ||
    game.release_date ||
    (game.genres && game.genres.length > 0) ||
    (game.platforms && game.platforms.length > 0) ||
    game.cover_image_url ||
    game.description

  if (!hasAny) {
    return <p className="muted small">Nothing saved yet for the public catalog.</p>
  }

  return (
    <dl className="admin-igdb-dl">
      <IgdbRow label="IGDB id">{game.igdb_id != null ? String(game.igdb_id) : null}</IgdbRow>
      <IgdbRow label="Release">{game.release_date}</IgdbRow>
      <IgdbRow label="Genres">
        {game.genres && game.genres.length > 0 ? game.genres.join(', ') : null}
      </IgdbRow>
      <IgdbRow label="Platforms">
        {game.platforms && game.platforms.length > 0 ? game.platforms.join(', ') : null}
      </IgdbRow>
      <IgdbRow label="Cover URL">
        {game.cover_image_url ? (
          <a href={game.cover_image_url} target="_blank" rel="noreferrer">
            {game.cover_image_url}
          </a>
        ) : null}
      </IgdbRow>
      <IgdbRow label="Description" ddClassName="admin-igdb-desc">
        {game.description}
      </IgdbRow>
    </dl>
  )
}

export function AdminGameEdit() {
  const supabase = getSupabase()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { data, error: queryError } = useAdminGameEdit(id, !isNew)

  const [game, setGame] = useState<Game | null>(null)
  const [primaryTitle, setPrimaryTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [alternates, setAlternates] = useState<GameAlternateTitle[]>([])
  const [newAlternateTitle, setNewAlternateTitle] = useState('')
  const [linkCount, setLinkCount] = useState<number | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [igdbBusy, setIgdbBusy] = useState(false)
  const [igdbSaveBusy, setIgdbSaveBusy] = useState(false)
  const [igdbManualId, setIgdbManualId] = useState('')
  const [igdbPreview, setIgdbPreview] = useState<IgdbGamePreview | null>(null)

  const refreshGame = useCallback(() => {
    if (!id || isNew) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminGame(id) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.gamesCatalog })
  }, [id, isNew, queryClient])

  useEffect(() => {
    if (!data) return
    setGame(data.game)
    setPrimaryTitle(data.game.primary_title)
    setSlug(data.game.slug)
    setAlternates(data.alternates)
    setLinkCount(data.linkCount)
    setPageError(null)
  }, [data])

  useEffect(() => {
    if (!queryError) return
    setPageError(queryError instanceof Error ? queryError.message : 'Not found')
    setGame(null)
  }, [queryError])

  const adminGameDocTitle = useMemo(() => {
    const headline = (game?.primary_title ?? primaryTitle).trim() || 'Game'
    return pageTitle('Admin', isNew ? 'New game' : headline)
  }, [game, primaryTitle, isNew])

  useDocumentTitle(adminGameDocTitle)

  async function saveMeta(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = primaryTitle.trim()
    const trimmedSlug = slug.trim()
    if (!trimmedTitle || !trimmedSlug) {
      setPageError('Title and slug are required.')
      return
    }
    setBusy(true)
    setPageError(null)
    if (isNew) {
      const { data: inserted, error: insertError } = await supabase
        .from('games')
        .insert({ primary_title: trimmedTitle, slug: trimmedSlug })
        .select('id')
        .single()
      setBusy(false)
      if (insertError) {
        setPageError(insertError.message)
        return
      }
      navigate(`/admin/games/${(inserted as { id: string }).id}`, { replace: true })
      return
    }
    if (!game) return
    const { error: updateError } = await supabase
      .from('games')
      .update({ primary_title: trimmedTitle, slug: trimmedSlug, updated_at: new Date().toISOString() })
      .eq('id', game.id)
    setBusy(false)
    if (updateError) {
      setPageError(updateError.message)
      return
    }
    refreshGame()
  }

  async function addAlternate(event: FormEvent) {
    event.preventDefault()
    if (!game) return
    const titleToAdd = newAlternateTitle.trim()
    if (!titleToAdd) return
    setPageError(null)
    const { error } = await supabase.from('game_alternate_titles').insert({ game_id: game.id, title: titleToAdd })
    if (error) {
      setPageError(error.message)
      return
    }
    setNewAlternateTitle('')
    refreshGame()
  }

  async function removeAlternate(alternate: GameAlternateTitle) {
    if (!window.confirm(`Remove alternate title “${alternate.title}”?`)) return
    setPageError(null)
    const { error } = await supabase.from('game_alternate_titles').delete().eq('id', alternate.id)
    if (error) {
      setPageError(error.message)
      return
    }
    refreshGame()
  }

  async function deleteGame() {
    if (!game) return
    if (linkCount && linkCount > 0) {
      setPageError('Unlink this game from all tracks before deleting.')
      return
    }
    if (!window.confirm(`Delete game “${game.primary_title}”? This cannot be undone.`)) return
    setPageError(null)
    const { error } = await supabase.from('games').delete().eq('id', game.id)
    if (error) {
      setPageError(error.message)
      return
    }
    navigate('/admin/games')
  }

  function suggestSlugFromTitle() {
    setSlug(slugifyGameTitle(primaryTitle))
  }

  async function fetchFromIgdb() {
    if (!game) return
    setIgdbBusy(true)
    setPageError(null)
    const manualIdText = igdbManualId.trim()
    const parsedIgdbId = manualIdText ? Number.parseInt(manualIdText, 10) : NaN
    const requestBody: { game_id: string; igdb_id?: number; search_title?: string } = { game_id: game.id }
    if (Number.isFinite(parsedIgdbId) && parsedIgdbId > 0) {
      requestBody.igdb_id = parsedIgdbId
    } else if (primaryTitle.trim()) {
      requestBody.search_title = primaryTitle.trim()
    }

    const { data, error: invokeError } = await supabase.functions.invoke('igdb-fetch-game', { body: requestBody })
    setIgdbBusy(false)
    if (invokeError) {
      setPageError(invokeError.message)
      return
    }

    const payload = data as { error?: unknown; preview?: IgdbGamePreview } | null
    if (payload?.error) {
      setPageError(String(payload.error))
      return
    }
    const preview = payload?.preview
    if (!preview || typeof preview.igdb_id !== 'number') {
      setPageError('Unexpected response from IGDB function.')
      return
    }
    setIgdbPreview(preview)
  }

  async function saveIgdbCatalog() {
    if (!game || !igdbPreview) return
    setIgdbSaveBusy(true)
    setPageError(null)
    const { error } = await supabase
      .from('games')
      .update({
        igdb_id: igdbPreview.igdb_id,
        cover_image_url: igdbPreview.cover_image_url,
        genres: igdbPreview.genres.length ? igdbPreview.genres : null,
        platforms: igdbPreview.platforms.length ? igdbPreview.platforms : null,
        release_date: igdbPreview.release_date,
        description: igdbPreview.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', game.id)
    setIgdbSaveBusy(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setIgdbPreview(null)
    refreshGame()
  }

  if (!id) return null
  if (!isNew && pageError && !game) return <p className="banner warn">{pageError}</p>
  if (!isNew && !game) return <LoadingState label="Loading game..." size="page" />

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/games">← Games</Link>
      </p>
      <h1>{isNew ? 'New game' : game?.primary_title}</h1>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

      <section className="section">
        <h2>Canonical name &amp; URL</h2>
        <form className="form tight" onSubmit={saveMeta}>
          <label className="field">
            <span>Primary title</span>
            <input value={primaryTitle} onChange={(e) => setPrimaryTitle(e.target.value)} required maxLength={300} />
          </label>
          <label className="field">
            <span>URL</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required maxLength={320} />
          </label>
          <div className="row tight">
            <button type="button" className="button ghost small" onClick={suggestSlugFromTitle}>
              URL from title
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
        {!isNew && game ? (
          <p className="muted small">
            Public page: <Link to={`/games/${encodeURIComponent(game.slug)}`}>/games/{game.slug}</Link>
            {linkCount != null ? ` ${linkCount} track link(s)` : null}
          </p>
        ) : null}
      </section>

      {!isNew && game ? (
        <>
          <section className="section">
            <h2>IGDB metadata</h2>
            <label className="field tight">
              <span>IGDB game id (optional)</span>
              <input
                inputMode="numeric"
                placeholder="Leave empty to search by primary title below"
                value={igdbManualId}
                onChange={(e) => setIgdbManualId(e.target.value)}
              />
            </label>
            <div className="row tight admin-igdb-actions">
              <button type="button" className="button" disabled={igdbBusy} onClick={() => void fetchFromIgdb()}>
                {igdbBusy ? 'Fetching from IGDB...' : 'Fetch preview from IGDB'}
              </button>
              {igdbPreview ? (
                <>
                  <button type="button" className="button primary" disabled={igdbSaveBusy} onClick={() => void saveIgdbCatalog()}>
                    {igdbSaveBusy ? 'Saving...' : 'Save catalog metadata'}
                  </button>
                  <button type="button" className="button ghost" disabled={igdbSaveBusy} onClick={() => setIgdbPreview(null)}>
                    Discard preview
                  </button>
                </>
              ) : null}
            </div>
            {igdbPreview ? (
              <div className="admin-igdb-preview">
                <p className="banner warn admin-igdb-preview-banner">Preview only</p>
                <h3 className="admin-igdb-preview-title">IGDB preview</h3>
                <IgdbPreviewDetails preview={igdbPreview} />
              </div>
            ) : null}
            <h3 className="admin-igdb-saved-title">Saved on this game</h3>
            <SavedCatalogDetails game={game} />
          </section>

          <section className="section">
            <h2>Alternate titles</h2>
            <p className="muted small">Regional names and other accepted titles</p>
            <ul className="stack">
              {alternates.map((alternate) => (
                <li key={alternate.id} className="row spread">
                  <span>{alternate.title}</span>
                  <button type="button" className="button small ghost" onClick={() => void removeAlternate(alternate)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form className="form row-form tight" onSubmit={addAlternate}>
              <label className="field grow">
                <span>New alternate</span>
                <input value={newAlternateTitle} onChange={(e) => setNewAlternateTitle(e.target.value)} maxLength={300} />
              </label>
              <button type="submit" className="button">
                Add
              </button>
            </form>
          </section>

          <section className="section">
            <h2>Danger zone</h2>
            <button type="button" className="button ghost" onClick={() => void deleteGame()}>
              Delete game...
            </button>
          </section>
        </>
      ) : null}
    </div>
  )
}
