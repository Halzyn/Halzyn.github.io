import { useEffect } from 'react'

export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, onEscape])
}
