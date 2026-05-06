export function parseTrackNumberFromFileName(fileName: string): number | null {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const stem = base.replace(/\.[^/.]+$/i, '')
  if (!/^\d+$/.test(stem)) return null
  const number = parseInt(stem, 10)
  if (!Number.isFinite(number) || number < 1) return null
  return number
}
