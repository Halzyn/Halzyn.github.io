import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

const SEPARATOR = ' *** '
const PIXELS_PER_SECOND = 28

type DisplayState = {
  scrolls: boolean
  content: string
  shiftPx?: number
  durationSec?: number
}

function measureTextWidth(measureEl: HTMLSpanElement, content: string): number {
  measureEl.textContent = content
  return measureEl.getBoundingClientRect().width
}

function buildNowPlayingDisplay(
  viewportEl: HTMLDivElement,
  measureEl: HTMLSpanElement,
  text: string,
): DisplayState {
  const viewportWidth = viewportEl.clientWidth
  const textWidth = measureTextWidth(measureEl, text)

  if (textWidth <= viewportWidth + 1) {
    return { scrolls: false, content: text }
  }

  const loopUnit = `${text}${SEPARATOR}`
  const shiftPx = measureTextWidth(measureEl, loopUnit)
  const durationSec = Math.max(6, shiftPx / PIXELS_PER_SECOND)

  return {
    scrolls: true,
    content: `${loopUnit}${loopUnit}`,
    shiftPx,
    durationSec,
  }
}

type ScrollingNowPlayingDisplayProps = {
  text: string
  scrollKey?: string | null
}

export function ScrollingNowPlayingDisplay({ text, scrollKey }: ScrollingNowPlayingDisplayProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState<DisplayState | null>(null)

  const trimmed = text.trim()
  const animationKey = scrollKey ?? trimmed

  useLayoutEffect(() => {
    setDisplay(null)

    const viewportEl = viewportRef.current
    const measureEl = measureRef.current
    if (!viewportEl || !measureEl || !trimmed) return

    function updateDisplay() {
      const vp = viewportRef.current
      const ms = measureRef.current
      if (!vp || !ms || !trimmed || vp.clientWidth <= 0) return
      setDisplay(buildNowPlayingDisplay(vp, ms, trimmed))
    }

    updateDisplay()

    const resizeObserver = new ResizeObserver(updateDisplay)
    resizeObserver.observe(viewportEl)

    return () => resizeObserver.disconnect()
  }, [trimmed, animationKey])

  if (!trimmed) return null

  const trackStyle: CSSProperties | undefined =
    display?.scrolls && display.shiftPx != null && display.durationSec != null
      ? {
          ['--marquee-shift' as string]: `${display.shiftPx}px`,
          animationDuration: `${display.durationSec}s`,
        }
      : undefined

  return (
    <div className="site-audio-player-now-playing" aria-live="polite">
      <div ref={viewportRef} className="site-audio-player-now-playing-viewport">
        <span ref={measureRef} className="site-audio-player-now-playing-measure" aria-hidden />
        <span
          key={animationKey}
          className={`site-audio-player-now-playing-track${display?.scrolls ? ' site-audio-player-now-playing-track--scroll' : ''}`}
          style={trackStyle}
        >
          {display?.content ?? trimmed}
        </span>
      </div>
    </div>
  )
}
