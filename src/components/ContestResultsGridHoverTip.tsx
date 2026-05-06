import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const OFFSET_BELOW_PX = 8

type Props = {
  content: string
  children: ReactNode
}

export function ResultsGridHoverTip({ content, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const hide = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [open, hide])

  const show = useCallback(() => {
    const element = wrapRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    setPosition({ top: rect.bottom + OFFSET_BELOW_PX, left: rect.left })
    setOpen(true)
  }, [])

  return (
    <>
      <div ref={wrapRef} className="results-tip-hover" onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </div>
      {open &&
        createPortal(
          <div className="results-tip-portal" style={{ top: position.top, left: position.left }}>
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
