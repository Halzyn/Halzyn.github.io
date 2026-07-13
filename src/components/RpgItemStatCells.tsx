import {
  formatItemStatValue,
  itemStatCompareClass,
  RPG_STAT_KEYS,
  RPG_STAT_LABELS,
  type RpgItem,
  type RpgStatKey,
} from '../lib/rpgItems'

type Props = {
  item: RpgItem
  compareTo?: RpgItem | null
  showHeaders?: boolean
}

export function RpgItemStatHeaders() {
  return (
    <>
      {RPG_STAT_KEYS.map((key) => (
        <th key={key} className="rpg-shop-stat-head">
          {RPG_STAT_LABELS[key]}
        </th>
      ))}
    </>
  )
}

export function RpgItemStatCells({ item, compareTo }: Props) {
  return (
    <>
      {RPG_STAT_KEYS.map((key) => {
        const index = RPG_STAT_KEYS.indexOf(key as RpgStatKey)
        const statType = (item.statTypes[index] ?? 'a') as 'a' | 'm'
        const value = item.stats[key]
        const text = formatItemStatValue(value, statType)
        const compareClass = itemStatCompareClass(item, key, compareTo)
        return (
          <td key={key} className={compareClass ? `rpg-shop-stat rpg-shop-stat--${compareClass}` : 'rpg-shop-stat'}>
            {text || '\u00a0'}
          </td>
        )
      })}
    </>
  )
}

export function RpgItemStatInline({ item }: { item: RpgItem }) {
  return (
    <div className="rpg-shop-stat-inline">
      {RPG_STAT_KEYS.map((key) => {
        const index = RPG_STAT_KEYS.indexOf(key)
        const statType = (item.statTypes[index] ?? 'a') as 'a' | 'm'
        const text = formatItemStatValue(item.stats[key], statType)
        if (!text) return null
        return (
          <span key={key} className="rpg-shop-stat-chip">
            {RPG_STAT_LABELS[key]} {text}
          </span>
        )
      })}
    </div>
  )
}
