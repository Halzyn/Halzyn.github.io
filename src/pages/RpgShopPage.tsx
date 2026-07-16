import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { RpgItemStatCells, RpgItemStatHeaders, RpgItemStatInline } from '../components/RpgItemStatCells'
import { LoadingState } from '../components/LoadingState'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../lib/pageTitle'
import {
  buyRpgItem,
  equipRpgItem,
  fetchRpgCategoryItems,
  fetchRpgShopState,
  sellRpgItem,
  unequipRpgItem,
} from '../lib/queries/rpgShop'
import {
  CATEGORY_TO_SLOT,
  EQUIPMENT_SLOT_KEYS,
  EQUIPMENT_SLOT_LABELS,
  equippedItems,
  sellRefundGp,
  type RpgItem,
  type RpgShopCategory,
  type RpgShopState,
} from '../lib/rpgItems'
import { tabButtonClass } from '../lib/tabButtonClass'
import { extractErrorMessage } from '../lib/utils'

type ShopTab = 'shop' | 'inventory'

function ownedItemIds(state: RpgShopState | null): Set<number> {
  if (!state) return new Set()
  const ids = new Set<number>()
  for (const item of state.inventory) ids.add(item.id)
  for (const item of equippedItems(state.equipment)) ids.add(item.id)
  return ids
}

function equippedItemForCategory(state: RpgShopState | null, categoryId: number): RpgItem | null {
  if (!state) return null
  const slot = CATEGORY_TO_SLOT[categoryId]
  if (!slot) return null
  return state.equipment[slot]
}

function itemRowClass(
  item: RpgItem,
  state: RpgShopState,
  selectedId: number | null,
  categoryId: number | null,
): string {
  const classes = ['rpg-shop-item-row']
  if (selectedId === item.id) classes.push('is-selected')
  const equipped = categoryId != null ? equippedItemForCategory(state, categoryId) : null
  if (equipped?.id === item.id) classes.push('is-equipped')
  else if (item.priceGp > state.availableGp || item.priceGcoins > state.gcoins) classes.push('is-unaffordable')
  return classes.join(' ')
}

export function RpgShopPage() {
  useDocumentTitle(pageTitle('Shop'))
  const { session, sessionReady, ready } = useAuth()
  const [tab, setTab] = useState<ShopTab>('shop')
  const [state, setState] = useState<RpgShopState | null>(null)
  const [categoryItems, setCategoryItems] = useState<RpgItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const ownedIds = useMemo(() => ownedItemIds(state), [state])

  const refreshState = useCallback(async () => {
    setActionError(null)
    const next = await fetchRpgShopState()
    setState(next)
    return next
  }, [])

  useEffect(() => {
    if (!sessionReady || !session) {
      if (sessionReady) setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const next = await refreshState()
        if (!cancelled && next.categories.length) {
          setSelectedCategoryId(next.categories[0]?.id ?? null)
        }
      } catch (err) {
        if (!cancelled) setActionError(extractErrorMessage(err, 'Failed to load shop'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, sessionReady, refreshState])

  useEffect(() => {
    if (!selectedCategoryId || tab !== 'shop') return
    let cancelled = false
    ;(async () => {
      setCategoryLoading(true)
      try {
        const items = await fetchRpgCategoryItems(selectedCategoryId)
        if (!cancelled) setCategoryItems(items)
      } catch (err) {
        if (!cancelled) setActionError(extractErrorMessage(err, 'Failed to load items'))
      } finally {
        if (!cancelled) setCategoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedCategoryId, tab])

  const runAction = useCallback(async (action: () => Promise<RpgShopState>) => {
    setActionBusy(true)
    setActionError(null)
    try {
      const next = await action()
      setState(next)
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Action failed'))
    } finally {
      setActionBusy(false)
    }
  }, [])

  if (!sessionReady || !ready) return <LoadingState label="Loading..." size="page" />
  if (!session) return <Navigate to="/auth" replace />

  if (loading) return <LoadingState label="Loading shop..." size="page" />
  if (!state) {
    return (
      <div className="page">
        <p className="banner warn">{actionError ?? 'Could not load the item shop.'}</p>
      </div>
    )
  }

  const selectedCategory = state.categories.find((c) => c.id === selectedCategoryId) ?? null
  const equippedInCategory = selectedCategoryId != null ? equippedItemForCategory(state, selectedCategoryId) : null

  return (
    <div className="page rpg-shop-page">
      <header className="rpg-shop-header">
        <div>
          <h1>Shop</h1>
          <p className="muted">Buy somethin' will ya!</p>
        </div>
        <div className="rpg-shop-wallet" aria-label="GP wallet">
          <div className="rpg-shop-wallet-box">
            <div className="rpg-shop-wallet-value">{state.availableGp.toLocaleString()}</div>
            <div className="rpg-shop-wallet-label">GP available</div>
          </div>
          <div className="rpg-shop-wallet-meta muted small">
            Earned {state.gpEarned.toLocaleString()} ◦ Spent {state.gpSpent.toLocaleString()}
            {state.gcoins > 0 ? ` ◦ gcoins ${state.gcoins.toLocaleString()}` : ''}
          </div>
        </div>
      </header>

      {actionError ? <p className="banner warn">{actionError}</p> : null}

      <div className="rpg-shop-tabs" role="tablist" aria-label="Shop views">
        <button type="button" role="tab" className={tabButtonClass(tab === 'shop')} onClick={() => setTab('shop')}>
          Shop
        </button>
        <button type="button" role="tab" className={tabButtonClass(tab === 'inventory')} onClick={() => setTab('inventory')}>
          Inventory ({state.inventory.length})
        </button>
      </div>

      {tab === 'shop' ? (
        <div className="rpg-shop-layout">
          <section className="section rpg-shop-categories">
            <h2>Categories</h2>
            <ul className="rpg-shop-category-list">
              {state.categories.map((category: RpgShopCategory) => {
                const equipped = equippedItemForCategory(state, category.id)
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      className={selectedCategoryId === category.id ? 'rpg-shop-category is-active' : 'rpg-shop-category'}
                      onClick={() => {
                        setSelectedCategoryId(category.id)
                        setSelectedItemId(null)
                      }}
                    >
                      <span className="rpg-shop-category-name">{category.name}</span>
                      <span className="rpg-shop-category-desc muted small">{category.description}</span>
                      <span className="rpg-shop-category-equipped muted small">
                        Equipped: {equipped?.name ?? '-'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="section rpg-shop-items-panel">
            {selectedCategory ? (
              <>
                <h2>{selectedCategory.name}</h2>
                {categoryLoading ? (
                  <LoadingState label="Loading items..." />
                ) : categoryItems.length === 0 ? (
                  <p className="muted">No items in this category.</p>
                ) : (
                  <div className="rpg-shop-table-wrap">
                    <table className="rpg-shop-table">
                      <thead>
                        <tr>
                          <th>Actions</th>
                          <th>Item</th>
                          <RpgItemStatHeaders />
                          <th>GP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item) => {
                          const isOwned = ownedIds.has(item.id)
                          const isEquipped = equippedInCategory?.id === item.id
                          const canBuy =
                            !isOwned &&
                            item.priceGp <= state.availableGp &&
                            item.priceGcoins <= state.gcoins
                          return (
                            <tr
                              key={item.id}
                              id={`item-${item.id}`}
                              className={itemRowClass(item, state, selectedItemId, selectedCategoryId)}
                              onClick={() => setSelectedItemId(item.id)}
                            >
                              <td>
                                <div className="rpg-shop-actions">
                                {isEquipped ? (
                                  <button
                                    type="button"
                                    className="button small ghost"
                                    disabled={actionBusy}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void runAction(() => sellRpgItem(item.id))
                                    }}
                                  >
                                    Sell ({sellRefundGp(item).toLocaleString()} GP)
                                  </button>
                                ) : isOwned ? (
                                  <>
                                    <button
                                      type="button"
                                      className="button small primary"
                                      disabled={actionBusy}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void runAction(() => equipRpgItem(item.id))
                                      }}
                                    >
                                      Equip
                                    </button>
                                    <button
                                      type="button"
                                      className="button small ghost"
                                      disabled={actionBusy}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void runAction(() => sellRpgItem(item.id))
                                      }}
                                    >
                                      Sell
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="button small primary"
                                    disabled={actionBusy || !canBuy}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void runAction(() => buyRpgItem(item.id))
                                    }}
                                  >
                                    Buy
                                  </button>
                                )}
                                </div>
                              </td>
                              <td className="rpg-shop-item-cell">
                                <div className="rpg-shop-item-name">{item.name}</div>
                                <div className="rpg-shop-item-desc muted small">{item.description}</div>
                              </td>
                              <RpgItemStatCells item={item} compareTo={equippedInCategory} />
                              <td className="rpg-shop-price">{item.priceGp.toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">Pick a category to browse items.</p>
            )}
          </section>
        </div>
      ) : (
        <section className="section">
          <h2>Inventory</h2>
          {state.inventory.length === 0 ? (
            <p className="muted">Your inventory is empty. Buy something from the shop!</p>
          ) : (
            <ul className="card-list rpg-shop-inventory-list">
              {state.inventory.map((item) => (
                <li key={item.id} className="card rpg-shop-inventory-card">
                  <div className="rpg-shop-inventory-main">
                    <div>
                      <div className="card-title">{item.name}</div>
                      <div className="muted small">{item.description}</div>
                      <div className="muted small">
                        {EQUIPMENT_SLOT_LABELS[CATEGORY_TO_SLOT[item.categoryId] ?? 'accessory']} ◦ Paid{' '}
                        {item.priceGp.toLocaleString()} GP
                      </div>
                    </div>
                    <div className="rpg-shop-inventory-actions">
                      <button
                        type="button"
                        className="button small primary"
                        disabled={actionBusy}
                        onClick={() => void runAction(() => equipRpgItem(item.id))}
                      >
                        Equip
                      </button>
                      <button
                        type="button"
                        className="button small ghost"
                        disabled={actionBusy}
                        onClick={() => void runAction(() => sellRpgItem(item.id))}
                      >
                        Sell ({sellRefundGp(item).toLocaleString()} GP)
                      </button>
                    </div>
                  </div>
                  <div className="rpg-shop-inventory-stats">
                    <RpgItemStatInline item={item} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="profile-subhead">Currently equipped</h3>
          <ul className="muted rpg-shop-equipped-list">
            {EQUIPMENT_SLOT_KEYS.map((slot) => {
              const item = state.equipment[slot]
              const categoryId = Number(Object.entries(CATEGORY_TO_SLOT).find(([, s]) => s === slot)?.[0])
              return (
                <li key={slot}>
                  <span className="rpg-shop-equipped-slot">{EQUIPMENT_SLOT_LABELS[slot]}:</span>{' '}
                  {item ? (
                    <>
                      {item.name}
                      <button
                        type="button"
                        className="button small ghost"
                        disabled={actionBusy}
                        onClick={() => void runAction(() => unequipRpgItem(categoryId))}
                      >
                        Unequip
                      </button>
                    </>
                  ) : (
                    '-'
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="muted small rpg-shop-footnote">
        Items and stats are imported from{' '}
        <a href="https://github.com/acmlmboard/acmlmboard-2" target="_blank" rel="noreferrer">
          AcmlmBoard II
        </a>
        . Selling returns 60% of the purchase price.
      </p>
    </div>
  )
}
