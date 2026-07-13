import type { ProfileRpgStats } from './profileRpgStats'

export type RpgStatKey = 'hp' | 'mp' | 'atk' | 'def' | 'int' | 'mdf' | 'dex' | 'lck' | 'spd'

export const RPG_STAT_KEYS: RpgStatKey[] = ['hp', 'mp', 'atk', 'def', 'int', 'mdf', 'dex', 'lck', 'spd']

export const RPG_STAT_LABELS: Record<RpgStatKey, string> = {
  hp: 'HP',
  mp: 'MP',
  atk: 'Atk',
  def: 'Def',
  int: 'Int',
  mdf: 'MDf',
  dex: 'Dex',
  lck: 'Lck',
  spd: 'Spd',
}

export type RpgItemStats = Record<RpgStatKey, number>

export type RpgItem = {
  id: number
  categoryId: number
  typeId: number
  name: string
  description: string
  hidden: boolean
  statTypes: string
  stats: RpgItemStats
  priceGp: number
  priceGcoins: number
}

export type RpgEquipmentLoadout = {
  weapon: RpgItem | null
  armor: RpgItem | null
  shield: RpgItem | null
  helm: RpgItem | null
  boots: RpgItem | null
  accessory: RpgItem | null
}

export type RpgShopCategory = {
  id: number
  sortOrder: number
  name: string
  description: string
  equippedItemId: number | null
}

export type RpgShopState = {
  gpEarned: number
  gpSpent: number
  availableGp: number
  gcoins: number
  equipment: RpgEquipmentLoadout
  inventory: RpgItem[]
  categories: RpgShopCategory[]
}

export const EQUIPMENT_SLOT_KEYS = ['weapon', 'armor', 'shield', 'helm', 'boots', 'accessory'] as const
export type EquipmentSlotKey = (typeof EQUIPMENT_SLOT_KEYS)[number]

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlotKey, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  helm: 'Helm',
  boots: 'Boots',
  accessory: 'Accessory',
}

export const CATEGORY_TO_SLOT: Record<number, EquipmentSlotKey> = {
  1: 'weapon',
  2: 'armor',
  3: 'shield',
  4: 'helm',
  5: 'boots',
  6: 'accessory',
}

export const SELL_REFUND_RATE = 0.6

function parseItemStats(raw: unknown): RpgItemStats {
  const stats = (raw ?? {}) as Partial<Record<RpgStatKey, number>>
  return {
    hp: Number(stats.hp ?? 0),
    mp: Number(stats.mp ?? 0),
    atk: Number(stats.atk ?? 0),
    def: Number(stats.def ?? 0),
    int: Number(stats.int ?? 0),
    mdf: Number(stats.mdf ?? 0),
    dex: Number(stats.dex ?? 0),
    lck: Number(stats.lck ?? 0),
    spd: Number(stats.spd ?? 0),
  }
}

export function parseRpgItem(raw: unknown): RpgItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (row.id == null) return null
  return {
    id: Number(row.id),
    categoryId: Number(row.categoryId),
    typeId: Number(row.typeId ?? 0),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    hidden: Boolean(row.hidden),
    statTypes: String(row.statTypes ?? 'aaaaaaaaa').padEnd(9, 'a').slice(0, 9),
    stats: parseItemStats(row.stats),
    priceGp: Number(row.priceGp ?? 0),
    priceGcoins: Number(row.priceGcoins ?? 0),
  }
}

export function parseRpgEquipmentLoadout(raw: unknown): RpgEquipmentLoadout {
  const row = (raw ?? {}) as Record<string, unknown>
  const slot = (key: EquipmentSlotKey) => parseRpgItem(row[key])
  return {
    weapon: slot('weapon'),
    armor: slot('armor'),
    shield: slot('shield'),
    helm: slot('helm'),
    boots: slot('boots'),
    accessory: slot('accessory'),
  }
}

export function parseRpgShopState(raw: unknown): RpgShopState | null {
  let row: unknown = raw
  if (typeof raw === 'string') {
    try {
      row = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const record = row as Record<string, unknown>
  const inventory = Array.isArray(record.inventory)
    ? record.inventory.map(parseRpgItem).filter((item): item is RpgItem => item != null)
    : []
  const categories = Array.isArray(record.categories)
    ? record.categories
        .map((cat) => {
          const c = cat as Record<string, unknown>
          return {
            id: Number(c.id),
            sortOrder: Number(c.sortOrder ?? 0),
            name: String(c.name ?? ''),
            description: String(c.description ?? ''),
            equippedItemId: c.equippedItemId == null ? null : Number(c.equippedItemId),
          }
        })
        .filter((c) => c.id >= 1 && c.id <= 6)
    : []

  return {
    gpEarned: Number(record.gpEarned ?? 0),
    gpSpent: Number(record.gpSpent ?? 0),
    availableGp: Number(record.availableGp ?? 0),
    gcoins: Number(record.gcoins ?? 0),
    equipment: parseRpgEquipmentLoadout(record.equipment),
    inventory,
    categories,
  }
}

export function equippedItems(loadout: RpgEquipmentLoadout): RpgItem[] {
  return EQUIPMENT_SLOT_KEYS.map((slot) => loadout[slot]).filter((item): item is RpgItem => item != null)
}

export function formatItemStatValue(value: number, statType: 'a' | 'm'): string {
  if (statType === 'm') {
    const mult = value / 100
    if (!mult || mult === 1) return ''
    return `x${mult.toFixed(2)}`
  }
  if (!value) return ''
  return value > 0 ? `+${value}` : String(value)
}

export function itemStatCompareClass(
  item: RpgItem,
  statKey: RpgStatKey,
  compareTo: RpgItem | null | undefined,
): 'higher' | 'equal' | 'lower' | '' {
  if (!compareTo) return ''
  const index = RPG_STAT_KEYS.indexOf(statKey)
  const itemType = item.statTypes[index] ?? 'a'
  const compareType = compareTo.statTypes[index] ?? 'a'
  if (itemType !== compareType) return ''
  const itemValue = item.stats[statKey]
  const compareValue = compareTo.stats[statKey]
  if (itemValue > compareValue) return 'higher'
  if (itemValue === compareValue) return 'equal'
  if (itemValue < compareValue) return 'lower'
  return ''
}

export function applyEquipmentToRpgStats(base: ProfileRpgStats, items: RpgItem[]): ProfileRpgStats {
  const totals: RpgItemStats = {
    hp: 0,
    mp: 0,
    atk: 0,
    def: 0,
    int: 0,
    mdf: 0,
    dex: 0,
    lck: 0,
    spd: 0,
  }
  const multipliers: RpgItemStats = {
    hp: 1,
    mp: 1,
    atk: 1,
    def: 1,
    int: 1,
    mdf: 1,
    dex: 1,
    lck: 1,
    spd: 1,
  }

  for (const item of items) {
    RPG_STAT_KEYS.forEach((key, index) => {
      const mode = item.statTypes[index] ?? 'a'
      const value = item.stats[key]
      if (mode === 'm') {
        multipliers[key] *= value / 100
      } else {
        totals[key] += value
      }
    })
  }

  const apply = (baseValue: number, key: RpgStatKey) =>
    Math.max(0, Math.round((baseValue + totals[key]) * multipliers[key]))

  return {
    ...base,
    hpCurrent: apply(base.hpCurrent, 'hp'),
    hpMax: apply(base.hpMax, 'hp'),
    mpCurrent: apply(base.mpCurrent, 'mp'),
    mpMax: apply(base.mpMax, 'mp'),
    atk: apply(base.atk, 'atk'),
    def: apply(base.def, 'def'),
    int: apply(base.int, 'int'),
    mdf: apply(base.mdf, 'mdf'),
    dex: apply(base.dex, 'dex'),
    lck: apply(base.lck, 'lck'),
    spd: apply(base.spd, 'spd'),
  }
}

export function sellRefundGp(item: RpgItem): number {
  return Math.floor(item.priceGp * SELL_REFUND_RATE)
}
