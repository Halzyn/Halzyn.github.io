import { renderCommentMarkdown } from '../lib/commentMarkdown'

type Props = { body: string; className?: string }

export function CommentMarkdownBody({ body, className = '' }: Props) {
  return <div className={['comment-md-body', className].filter(Boolean).join(' ')}>{renderCommentMarkdown(body)}</div>
}
