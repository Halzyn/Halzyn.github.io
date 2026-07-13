import { useEffect } from 'react'
import type { PageMeta } from '../lib/siteMeta'

function upsertMeta(selector: string, createAttrs: Record<string, string>, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    for (const [key, value] of Object.entries(createAttrs)) {
      element.setAttribute(key, value)
    }
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

export function usePageMeta(meta: PageMeta | null | undefined): void {
  useEffect(() => {
    if (!meta) return

    document.title = meta.title

    upsertMeta('meta[name="description"]', { name: 'description' }, meta.description)
    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, meta.type ?? 'website')
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'VGMGC')
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, meta.title)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, meta.description)
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, meta.url)

    const image = meta.image?.trim()
    if (image) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image)
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image)
    }

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, meta.title)
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, meta.description)
    upsertLink('canonical', meta.url)
  }, [meta])
}
