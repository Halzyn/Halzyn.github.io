import { useCallback, useMemo, useState } from 'react'

export function useCollapsibleResultsColumns() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const isCollapsed = useCallback((key: string) => collapsed.has(key), [collapsed])

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const layoutKey = useMemo(() => [...collapsed].sort().join(','), [collapsed])

  return { collapsed, isCollapsed, toggle, layoutKey }
}

export function resultsColClass(base: string, collapsed: boolean, extra = ''): string {
  const parts = [base]
  if (collapsed) parts.push('results-col--collapsed')
  if (extra) parts.push(extra)
  return parts.join(' ')
}
