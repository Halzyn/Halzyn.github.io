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

function measureStickyLeftPixels(table: HTMLTableElement, scrollHost: HTMLElement): number[] | null {
  const cells = leadStickyCells(table)
  if (!cells) return null

  const rects = cells.map((c) => c.getBoundingClientRect())
  if (rects.some((r) => !Number.isFinite(r.left) || r.width < 0.5)) return null

  const scrollPortLeft = scrollHost.getBoundingClientRect().left + scrollHost.clientLeft
  const scrollLeft = scrollHost.scrollLeft

  const base = rects[0]!.left - scrollPortLeft + scrollLeft
  const leftPx: number[] = [base]
  for (let i = 1; i < STICKY_COLS; i++) {
    leftPx.push(leftPx[i - 1]! + rects[i - 1]!.width)
  }

  if (leftPx.some((x) => !Number.isFinite(x)) || leftPx.some((_, i) => i > 0 && leftPx[i]! < leftPx[i - 1]!)) {
    return null
  }

  return leftPx
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

    function measure(host: HTMLElement): void {
      const table = host.querySelector<HTMLTableElement>(GRID_SELECTOR)
      if (!table) return
      const scrollHost = nearestScrollHostForTable(table) ?? host
      const cells = leadStickyCells(table)
      if (!cells) return

      if (!shouldEnableStickyLead(table, scrollHost, cells)) {
        clearStickyFromHosts(host)
        return
      }

      setStickyLeadActive(host, true)
      const leftPx = measureStickyLeftPixels(table, scrollHost)
      if (!leftPx) {
        clearStickyFromHosts(host)
        return
      }
      applyStickyToHosts(host, table, leftPx)
    }

    const scheduleMeasure = () => requestAnimationFrame(() => measure(scrollRoot))

    measure(scrollRoot)

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(scrollRoot)

    const table = scrollRoot.querySelector<HTMLTableElement>(GRID_SELECTOR)
    if (table) resizeObserver.observe(table)

    const intersectionObserver =
      table &&
      new IntersectionObserver(scheduleMeasure, {
        threshold: 0,
        rootMargin: '0px',
      })
    if (table && intersectionObserver) intersectionObserver.observe(table)

    const details = scrollRoot.closest('details')
    details?.addEventListener('toggle', scheduleMeasure)

    void document.fonts.ready.then(scheduleMeasure)

    window.addEventListener('resize', scheduleMeasure)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver?.disconnect()
      details?.removeEventListener('toggle', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      clearStickyFromHosts(scrollRoot)
    }
  }, [layoutKey])
}