import { createElement, Fragment, type ReactNode } from 'react'

export const COMMENT_MAX_LENGTH = 500

const URL_PATTERN = /^https?:\/\/\S+$/i

export function normalizeCommentUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeCommentUrl(url))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildLinkMarkdown(label: string, url: string): string {
  const safeLabel = label.trim() || url.trim()
  return `[${safeLabel}](${normalizeCommentUrl(url)})`
}

export function buildImageMarkdown(alt: string, url: string): string {
  return `![${alt.trim() || 'image'}](${normalizeCommentUrl(url)})`
}

export function insertCommentSnippet(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string,
): { next: string; selectionStart: number; selectionEnd: number } {
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd)
  const cursor = selectionStart + snippet.length
  return { next, selectionStart: cursor, selectionEnd: cursor }
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern =
    /(<b>[^<]+<\/b>|<i>[^<]+<\/i>|<s>[^<]+<\/s>|<u>[^<]+<\/u>|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/gi
  let last = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    const token = match[0]
    const key = `${keyPrefix}-${index++}`

    const boldHtml = /^<b>([^<]*)<\/b>$/i.exec(token)
    const italicHtml = /^<i>([^<]*)<\/i>$/i.exec(token)
    const strikeHtml = /^<s>([^<]*)<\/s>$/i.exec(token)
    const underlineHtml = /^<u>([^<]*)<\/u>$/i.exec(token)

    if (boldHtml) {
      nodes.push(createElement('b', { key }, boldHtml[1]))
    } else if (italicHtml) {
      nodes.push(createElement('i', { key }, italicHtml[1]))
    } else if (strikeHtml) {
      nodes.push(createElement('s', { key }, strikeHtml[1]))
    } else if (underlineHtml) {
      nodes.push(createElement('u', { key }, underlineHtml[1]))
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(createElement('b', { key }, token.slice(2, -2)))
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(createElement('i', { key }, token.slice(1, -1)))
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(createElement('s', { key }, token.slice(2, -2)))
    } else if (token.startsWith('![')) {
      const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token)
      if (imageMatch) {
        const alt = imageMatch[1]
        const src = normalizeCommentUrl(imageMatch[2].trim())
        if (isSafeUrl(src)) {
          nodes.push(
            createElement('img', {
              key,
              src,
              alt: alt || 'Image',
              className: 'comment-md-image',
              loading: 'lazy',
              decoding: 'async',
            }),
          )
        } else {
          nodes.push(token)
        }
      } else {
        nodes.push(token)
      }
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        const label = linkMatch[1]
        const href = normalizeCommentUrl(linkMatch[2].trim())
        if (isSafeUrl(href)) {
          nodes.push(
            createElement(
              'a',
              { key, href, target: '_blank', rel: 'noopener noreferrer' },
              label,
            ),
          )
        } else {
          nodes.push(token)
        }
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(token)
    }

    last = match.index + token.length
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }

  return nodes
}

export function renderCommentMarkdown(body: string): ReactNode {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let listItems: ReactNode[] | null = null
  let blockIndex = 0

  const flushList = () => {
    if (!listItems?.length) {
      listItems = null
      return
    }
    blocks.push(createElement('ul', { key: `ul-${blockIndex++}`, className: 'comment-md-list' }, listItems))
    listItems = null
  }

  for (const line of lines) {
    const bulletMatch = /^-\s+(.+)$/.exec(line)
    if (bulletMatch) {
      const item = parseInline(bulletMatch[1], `li-${blockIndex}-${listItems?.length ?? 0}`)
      if (!listItems) listItems = []
      listItems.push(createElement('li', { key: `li-${listItems.length}` }, item))
      continue
    }

    flushList()

    if (!line.trim()) {
      blocks.push(createElement('br', { key: `br-${blockIndex++}` }))
      continue
    }

    blocks.push(
      createElement(
        Fragment,
        { key: `p-${blockIndex++}` },
        parseInline(line, `line-${blockIndex}`),
        createElement('br', { key: `br-after-${blockIndex}` }),
      ),
    )
  }

  flushList()
  return createElement(Fragment, null, blocks)
}

export type MarkdownWrap =
  | { before: string; after: string; placeholder?: string }
  | { prefix: string; placeholder?: string }

export function wrapCommentSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  wrap: MarkdownWrap,
): { next: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd)
  const placeholder =
    ('placeholder' in wrap && wrap.placeholder) ||
    ('before' in wrap ? 'text' : 'item')

  if ('prefix' in wrap) {
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEnd = value.indexOf('\n', selectionEnd)
    const end = lineEnd === -1 ? value.length : lineEnd
    const nextLine = selected.trim() ? `- ${selected}` : `${wrap.prefix}${placeholder}`
    const next = value.slice(0, lineStart) + nextLine + value.slice(end)
    const cursor = lineStart + nextLine.length
    return { next, selectionStart: cursor, selectionEnd: cursor }
  }

  const inner = selected || placeholder
  const insertion = `${wrap.before}${inner}${wrap.after}`
  const next = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd)
  const start = selectionStart + wrap.before.length
  const end = start + inner.length
  return { next, selectionStart: start, selectionEnd: end }
}

export function promptLinkOrImageSnippet(
  kind: 'link' | 'image',
  selectedText: string,
): string | null {
  const urlRaw = window.prompt(kind === 'link' ? 'Link URL' : 'Image URL')
  if (!urlRaw?.trim()) return null
  const url = normalizeCommentUrl(urlRaw.trim())
  if (!URL_PATTERN.test(url) && !/^https?:\/\//i.test(url)) {
    window.alert('Please enter a valid URL (e.g. example.com or https://...).')
    return null
  }
  if (!isSafeUrl(url)) {
    window.alert('Please enter a valid http(s) URL.')
    return null
  }
  if (kind === 'image') {
    const alt = window.prompt('Alt text (optional)', selectedText.trim() || 'image') ?? 'image'
    return buildImageMarkdown(alt, url)
  }
  const defaultLabel = selectedText.trim() || url
  const label = window.prompt('Link label', defaultLabel) ?? defaultLabel
  return buildLinkMarkdown(label, url)
}
