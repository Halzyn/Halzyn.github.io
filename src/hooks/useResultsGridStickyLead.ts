/**
 * Janky ass code to stop the first 4 columns in the results grid from scrolling out of view.
 * It's a miracle this works at all.
 */

import { useLayoutEffect, type RefObject } from 'react'

const STICKY_COLS = 4
const GRID_SELECTOR = 'table.results-unified-grid'
const HEADER_CELLS = 'thead tr th'

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
    host.style.setProperty(`--rg-sticky-left-${i}`, `${Math.round(leftPx[i])}px`)
  }
}

function clearStickyVars(host: HTMLElement | null): void {
  if (!host) return
  for (let i = 0; i < STICKY_COLS; i++) {
    host.style.removeProperty(`--rg-sticky-left-${i}`)
  }
}

function cumulativeLeftOffsets(widths: readonly number[]): number[] {
  const left: number[] = []
  let acc = 0
  for (let i = 0; i < STICKY_COLS; i++) {
    left.push(acc)
    acc += widths[i]!
  }
  return left
}

function measureStickyLeftPixels(table: HTMLTableElement): number[] | null {
  const ths = table.querySelectorAll<HTMLTableCellElement>(HEADER_CELLS)
  if (ths.length < STICKY_COLS) return null

  const widths = Array.from({ length: STICKY_COLS }, (_, i) => ths[i]!.getBoundingClientRect().width)
  if (widths.some((w) => w < 1)) return null

  return cumulativeLeftOffsets(widths)
}

function applyStickyToHosts(root: HTMLElement, table: HTMLTableElement, leftPx: readonly number[]): void {
  const scrollHost = nearestScrollHostForTable(table) ?? root
  for (const host of [scrollHost, table, root]) {
    setStickyVars(host, leftPx)
  }
}

function clearStickyFromHosts(root: HTMLElement): void {
  const table = root.querySelector<HTMLTableElement>(GRID_SELECTOR)
  const scrollHost = table ? nearestScrollHostForTable(table) : null
  for (const host of [scrollHost, table, root]) {
    clearStickyVars(host)
  }
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
      const leftPx = measureStickyLeftPixels(table)
      if (!leftPx) return
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
