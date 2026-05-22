import { useRef, type ReactNode } from 'react'
import {
  COMMENT_MAX_LENGTH,
  insertCommentSnippet,
  promptLinkOrImageSnippet,
  wrapCommentSelection,
  type MarkdownWrap,
} from '../lib/commentMarkdown'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  rows?: number
}

type Tool = {
  label: string
  title: string
  wrap?: MarkdownWrap
  action?: 'link' | 'image' | 'bullet'
}

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', wrap: { before: '<b>', after: '</b>' } },
  { label: 'I', title: 'Italic', wrap: { before: '<i>', after: '</i>' } },
  { label: 'U', title: 'Underline', wrap: { before: '<u>', after: '</u>' } },
  { label: 'S', title: 'Strikethrough', wrap: { before: '<s>', after: '</s>' } },
  { label: '•', title: 'Bullet list', action: 'bullet' },
  { label: 'Link', title: 'Insert link', action: 'link' },
  { label: 'Img', title: 'Insert image (hotlink URL)', action: 'image' },
]

export function CommentMarkdownEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  id,
  rows = 4,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function applyWrap(wrap: MarkdownWrap) {
    const element = textareaRef.current
    if (!element || disabled) return
    const { selectionStart, selectionEnd } = element
    const { next, selectionStart: start, selectionEnd: end } = wrapCommentSelection(
      value,
      selectionStart,
      selectionEnd,
      wrap,
    )
    if (next.length > COMMENT_MAX_LENGTH) return
    onChange(next)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start, end)
    })
  }

  function insertSnippet(snippet: string) {
    const el = textareaRef.current
    if (!el || disabled) return
    const { selectionStart, selectionEnd } = el
    const { next, selectionStart: start, selectionEnd: end } = insertCommentSnippet(
      value,
      selectionStart,
      selectionEnd,
      snippet,
    )
    if (next.length > COMMENT_MAX_LENGTH) return
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, end)
    })
  }

  function onTool(tool: Tool) {
    if (tool.action === 'link' || tool.action === 'image') {
      const element = textareaRef.current
      const selected = element ? value.slice(element.selectionStart, element.selectionEnd) : ''
      const snippet = promptLinkOrImageSnippet(tool.action, selected)
      if (snippet) insertSnippet(snippet)
      return
    }
    if (tool.action === 'bullet') {
      applyWrap({ prefix: '- ', placeholder: 'item' })
      return
    }
    if (tool.wrap) applyWrap(tool.wrap)
  }

  const remaining = COMMENT_MAX_LENGTH - value.length

  return (
    <div className="comment-editor site-inset">
      <div className="comment-editor-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            className="comment-editor-tool"
            title={tool.title}
            disabled={disabled}
            onClick={() => onTool(tool)}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        className="comment-editor-input"
        value={value}
        rows={rows}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="comment-editor-meta muted small" aria-live="polite">
        {remaining} characters left
      </p>
    </div>
  )
}

export function CommentMarkdownEditorHint(): ReactNode {
  return (
    <p className="muted small comment-editor-hint">
      Supports <code>&lt;b&gt;</code>bold<code>&lt;/b&gt;</code>, <code>&lt;i&gt;</code>italic<code>&lt;/i&gt;</code>, <code>&lt;u&gt;</code>underline<code>&lt;/u&gt;</code>, <code>&lt;s&gt;</code>
      strike<code>&lt;/s&gt;</code>, bullet lines (<code>- item</code>), [links](url), and ![images](url). Or just use the buttons, you goof.
    </p>
  )
}
