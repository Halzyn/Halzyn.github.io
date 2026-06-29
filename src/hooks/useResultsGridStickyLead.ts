/**
 * Janky ass code to stop the first 4 columns in the results grid from scrolling out of view.
 * It's a miracle this works at all.
 */

import { useLayoutEffect, type RefObject } from 'react'

const STICKY_COLS = 4
const GRID_SELECTOR = 'table.results-unified-grid'
const HEADER_CELLS = 'thead tr th'
const STICKY_LEAD_CLASS = 'results-grid-sticky-lead'
const MIN_SCROLLABLE_VIEWPORT_PX = 48

function overflowAllowsScroll(value: string): boolean {
  return value === 'auto' || value === 'scroll' || value === 'overlay'
}

function nearestScrollHostForTable(table: HTMLTableElement): HTMLElement | null {
  let element: HTMLElement | null = table.parentElement
  while (element) {
    const { overflow, overflowX, overflowY } = getComputedStyle(element)
    if (
      overflowAllowsScroll(overflowX) ||
      overflowAllowsScroll(overflowY) ||
      overflowAllowsScroll(overflow)
    ) {
      return element
    }
    element = element.parentElement
  }
  return null
}

function setStickyVars(host: HTMLElement, leftPx: readonly number[]): void {
  for (let i = 0; i < STICKY_COLS; i++) {
    host.style.setProperty(`--rg-sticky-left-${i}`, `${leftPx[i]}px`)
  }
}

function clearStickyVars(host: HTMLElement | null): void {
  if (!host) return
  for (let i = 0; i < STICKY_COLS; i++) {
    host.style.removeProperty(`--rg-sticky-left-${i}`)
  }
}

function leadStickyCells(table: HTMLTableElement): HTMLTableCellElement[] | null {
  const bodyRow = table.querySelector('tbody tr:first-child')
  if (bodyRow) {
    const tds = bodyRow.querySelectorAll<HTMLTableCellElement>('td')
    if (tds.length >= STICKY_COLS) {
      return Array.from(tds).slice(0, STICKY_COLS)
    }
  }
  const ths = table.querySelectorAll<HTMLTableCellElement>(HEADER_CELLS)
  if (ths.length < STICKY_COLS) return null
  return Array.from(ths).slice(0, STICKY_COLS)
}

function measureLeadWidth(cells: readonly HTMLTableCellElement[]): number {
  return cells.reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0)
}

function shouldEnableStickyLead(
  table: HTMLTableElement,
  scrollHost: HTMLElement,
  cells: readonly HTMLTableCellElement[],
): boolean {
  const viewportWidth = scrollHost.clientWidth
  if (viewportWidth < 1) return false

  if (table.scrollWidth <= viewportWidth + 1) return false

  const leadWidth = measureLeadWidth(cells)
  return viewportWidth - leadWidth >= MIN_SCROLLABLE_VIEWPORT_PX
}

function measureStickyLeftPixels(table: HTMLTableElement): number[] | null {
  const cells = leadStickyCells(table)
  if (!cells) return null

  const widths = cells.map((cell) => cell.getBoundingClientRect().width)
  if (widths.some((width) => !Number.isFinite(width) || width < 0.5)) return null

  const leftPx: number[] = [0]
  for (let i = 1; i < STICKY_COLS; i++) {
    leftPx.push(leftPx[i - 1]! + widths[i - 1]!)
  }

  return leftPx
}

function stickyOffsetsNearEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => Math.abs(value - b[index]!) < 0.5)
}

function applyStickyToHosts(root: HTMLElement, table: HTMLTableElement, leftPx: readonly number[]): void {
  const scrollHost = nearestScrollHostForTable(table) ?? root
  for (const host of [scrollHost, table, root]) {
    setStickyVars(host, leftPx)
  }
}

function clearStickyFromHosts(root: HTMLElement): void {
  root.classList.remove(STICKY_LEAD_CLASS)
  const table = root.querySelector<HTMLTableElement>(GRID_SELECTOR)
  const scrollHost = table ? nearestScrollHostForTable(table) : null
  for (const host of [scrollHost, table, root]) {
    clearStickyVars(host)
  }
}

function setStickyLeadActive(root: HTMLElement, active: boolean): void {
  root.classList.toggle(STICKY_LEAD_CLASS, active)
}

export function useResultsGridStickyLead(
  scrollRootRef: RefObject<HTMLElement | null>,
  layoutKey: number | string = 0,
) {
  useLayoutEffect(() => {
    const scrollRoot = scrollRootRef.current
    if (!scrollRoot) return

    let lastLeftPx: number[] | null = null
    let measureRaf = 0

    function measure(host: HTMLElement): void {
      const table = host.querySelector<HTMLTableElement>(GRID_SELECTOR)
      if (!table) return
      const scrollHost = nearestScrollHostForTable(table) ?? host
      const cells = leadStickyCells(table)
      if (!cells) return

      if (!shouldEnableStickyLead(table, scrollHost, cells)) {
        lastLeftPx = null
        clearStickyFromHosts(host)
        return
      }

      const leftPx = measureStickyLeftPixels(table)
      if (!leftPx) {
        lastLeftPx = null
        clearStickyFromHosts(host)
        return
      }

      if (lastLeftPx && stickyOffsetsNearEqual(leftPx, lastLeftPx)) return
      lastLeftPx = leftPx

      applyStickyToHosts(host, table, leftPx)
      setStickyLeadActive(host, true)
    }

    const scheduleMeasure = () => {
      cancelAnimationFrame(measureRaf)
      measureRaf = requestAnimationFrame(() => measure(scrollRoot))
    }

    measure(scrollRoot)

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(scrollRoot)

    const details = scrollRoot.closest('details')
    details?.addEventListener('toggle', scheduleMeasure)

    void document.fonts.ready.then(scheduleMeasure)

    window.addEventListener('resize', scheduleMeasure)

    return () => {
      cancelAnimationFrame(measureRaf)
      resizeObserver.disconnect()
      details?.removeEventListener('toggle', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      clearStickyFromHosts(scrollRoot)
    }
  }, [layoutKey])
}