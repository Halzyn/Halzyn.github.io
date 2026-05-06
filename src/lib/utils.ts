export function firstOf<T>(value: T | T[] | readonly T[] | null | undefined): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return (value[0] ?? null) as T | null
  return value as T
}

export function pushToMappedList<K extends string, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key) ?? []
  list.push(value)
  map.set(key, list)
}

export function uniqSorted(xs: readonly string[]): string[] {
  return [...new Set(xs)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
