import { getSupabase } from '../supabase'
import { parseRpgItem, parseRpgShopState, type RpgItem, type RpgShopState } from '../rpgItems'

export async function fetchRpgShopState(): Promise<RpgShopState> {
  const supabase = getSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase.rpc('rpg_get_shop_state')
  if (error) throw error

  const parsed = parseRpgShopState(data)
  if (!parsed) {
    throw new Error('Shop returned an unexpected response')
  }
  return parsed
}

export async function fetchRpgCategoryItems(categoryId: number): Promise<RpgItem[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpg_list_category_items', {
    p_category_id: categoryId,
  })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return data.map(parseRpgItem).filter((item): item is RpgItem => item != null)
}

export async function buyRpgItem(itemId: number): Promise<RpgShopState> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpg_buy_item', { p_item_id: itemId })
  if (error) throw error
  const parsed = parseRpgShopState(data)
  if (!parsed) throw new Error('Shop returned an unexpected response')
  return parsed
}

export async function equipRpgItem(itemId: number): Promise<RpgShopState> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpg_equip_item', { p_item_id: itemId })
  if (error) throw error
  const parsed = parseRpgShopState(data)
  if (!parsed) throw new Error('Shop returned an unexpected response')
  return parsed
}

export async function unequipRpgItem(categoryId: number): Promise<RpgShopState> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpg_unequip_item', { p_category_id: categoryId })
  if (error) throw error
  const parsed = parseRpgShopState(data)
  if (!parsed) throw new Error('Shop returned an unexpected response')
  return parsed
}

export async function sellRpgItem(itemId: number): Promise<RpgShopState> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpg_sell_item', { p_item_id: itemId })
  if (error) throw error
  const parsed = parseRpgShopState(data)
  if (!parsed) throw new Error('Shop returned an unexpected response')
  return parsed
}
