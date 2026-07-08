export type PpRankProfile = {
  id: string
  performance_points?: number | null
}

export function computePpRankByUserId(profiles: PpRankProfile[]): Map<string, number> {
  const byPp = [...profiles].sort((a, b) => (b.performance_points ?? 0) - (a.performance_points ?? 0))
  const map = new Map<string, number>()
  let rank = 0
  let prevPp: number | null = null
  for (let i = 0; i < byPp.length; i++) {
    const pp = byPp[i].performance_points ?? 0
    if (prevPp === null || pp < prevPp) {
      rank = i + 1
      prevPp = pp
    }
    map.set(byPp[i].id, rank)
  }
  return map
}

export function formatPlayerListPp(points: number | null | undefined): string {
  return `${Math.floor(points ?? 0)}pp`
}
